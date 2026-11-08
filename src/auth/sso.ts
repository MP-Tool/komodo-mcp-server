/**
 * Sign-in through an identity provider.
 *
 * For people whose Komodo account signs in through an OpenID Connect provider (Authentik,
 * Keycloak, …): they authenticate at that provider, and the MCP server asks Komodo Core for
 * a session of the same person — by exchanging the provider's ID token at Komodo's token
 * endpoint (OAuth 2.0 Token Exchange, RFC 8693). From there on the session is an ordinary
 * Komodo session: the person's own permissions decide what they can do.
 *
 * Komodo decides who a token stands for. It accepts one only when token exchange is
 * enabled for the provider, the token was issued to a client id Komodo trusts, and the
 * person already has a Komodo account linked to that provider. The MCP server never maps
 * identities itself.
 *
 * @module auth/sso
 */

import { LoginDeniedError, logger as baseLogger } from "mcp-server-framework";
import type { UpstreamLogin, UpstreamLoginConfig, RevalidatePrincipal } from "mcp-server-framework";
import { KomodoClient } from "../client.js";
import { config } from "../config/index.js";
import { AuthenticationError, ConnectionError } from "../errors/index.js";
import { auditLogin, buildKomodoContext, komodoAuthInfo } from "./komodo-identity.js";

const logger = baseLogger.child({ component: "komodo-sso" });

// ============================================================================
// Token Exchange (RFC 8693)
// ============================================================================

const TOKEN_EXCHANGE_GRANT = "urn:ietf:params:oauth:grant-type:token-exchange";
const ID_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:id_token";
const ACCESS_TOKEN_TYPE = "urn:ietf:params:oauth:token-type:access_token";
const JWT_TYPE = "urn:ietf:params:oauth:token-type:jwt";

/** The start-up probe does not need to wait as long as a real request may. */
const PROBE_TIMEOUT_MS = 5_000;

/** Where Komodo Core serves the exchange. */
function tokenEndpoint(komodoUrl: string): string {
  return `${komodoUrl.replace(/\/+$/, "")}/auth/token`;
}

/**
 * Why Komodo did not issue a session for a token.
 *
 * - `rejected` — Komodo has the endpoint and refused this token (`invalid_grant`): not
 *   issued to a client Komodo trusts, no linked account, a second factor is required, …
 * - `unsupported` — this Komodo has no token exchange, or not for what was sent.
 */
export class KomodoExchangeError extends Error {
  constructor(
    readonly kind: "rejected" | "unsupported",
    /** Komodo's own wording — for the log, not for the person signing in. */
    readonly detail: string,
  ) {
    super(`Komodo token exchange ${kind}: ${detail}`);
    this.name = "KomodoExchangeError";
  }
}

async function postForm(url: string, fields: Record<string, string>, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(fields).toString(),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw ConnectionError.failed(url, error instanceof Error ? error.message : String(error));
  }
}

/**
 * Error codes a token endpoint answers with (RFC 6749 §5.2, RFC 8693 §2.2.2, RFC 8707 §2).
 * Komodo's ordinary API errors are JSON with an `error` field as well — but that one holds
 * a sentence, with a `trace` next to it. Only a code from this list says "this is the token
 * endpoint speaking".
 */
const OAUTH_ERROR_CODES = new Set([
  "invalid_request",
  "invalid_client",
  "invalid_grant",
  "unauthorized_client",
  "unsupported_grant_type",
  "invalid_scope",
  "invalid_target",
  "temporarily_unavailable",
  "server_error",
]);

/**
 * Statuses with which a Komodo that has no token endpoint answers a request to it: the
 * route is unknown (404, 405), or another handler took the request and could not make
 * sense of it (400, 422).
 */
const NO_SUCH_ENDPOINT = new Set([400, 404, 405, 422]);

/** The OAuth error of a token-endpoint answer, or `undefined` when it is not one. */
function oauthErrorOf(body: Record<string, unknown> | undefined): { code: string; description: string } | undefined {
  const code = body?.["error"];
  if (typeof code !== "string" || !OAUTH_ERROR_CODES.has(code)) return undefined;
  const description = body?.["error_description"];
  return { code, description: typeof description === "string" ? description : "" };
}

/** The JSON body of a response, or `undefined` when it is not a JSON object. */
async function jsonObject(response: Response): Promise<Record<string, unknown> | undefined> {
  if (!(response.headers.get("content-type") ?? "").includes("json")) return undefined;
  try {
    const body: unknown = await response.json();
    return typeof body === "object" && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Exchange a provider's ID token for a Komodo session of the same person.
 *
 * @param komodoUrl - Komodo Core base URL
 * @param idToken - The validated ID token of the person who signed in
 * @returns The Komodo JWT
 * @throws {KomodoExchangeError} when Komodo refuses the token or has no token exchange
 * @throws {ConnectionError} when Komodo cannot be reached or answers unusably
 */
export async function exchangeIdTokenForKomodoJwt(komodoUrl: string, idToken: string): Promise<string> {
  const url = tokenEndpoint(komodoUrl);
  const response = await postForm(
    url,
    {
      grant_type: TOKEN_EXCHANGE_GRANT,
      subject_token: idToken,
      subject_token_type: ID_TOKEN_TYPE,
      requested_token_type: ACCESS_TOKEN_TYPE,
    },
    config.KOMODO_API_TIMEOUT_MS,
  );
  const body = await jsonObject(response);

  if (response.ok) {
    const jwt = body?.["access_token"];
    const issued = body?.["issued_token_type"];
    const tokenType = body?.["token_type"];
    // RFC 8693 §2.2.1: the answer says what it is. Anything but a bearer token for Komodo's
    // API is not something this server knows how to use.
    const usable =
      typeof jwt === "string" &&
      jwt.length > 0 &&
      (issued === ACCESS_TOKEN_TYPE || issued === JWT_TYPE) &&
      typeof tokenType === "string" &&
      tokenType.toLowerCase() === "bearer";
    if (!usable) throw ConnectionError.failed(url, "Komodo answered the token exchange without a usable token");
    return jwt;
  }

  const refusal = oauthErrorOf(body);
  if (refusal?.code === "invalid_grant") throw new KomodoExchangeError("rejected", refusal.description);
  if (refusal?.code === "invalid_request" || refusal?.code === "unsupported_grant_type") {
    throw new KomodoExchangeError("unsupported", `${refusal.code}: ${refusal.description}`);
  }
  if (!refusal && NO_SUCH_ENDPOINT.has(response.status)) {
    throw new KomodoExchangeError("unsupported", `no token endpoint (HTTP ${response.status})`);
  }
  throw ConnectionError.failed(url, `HTTP ${response.status}${refusal ? ` ${refusal.code}` : ""}`);
}

/** Whether Komodo Core offers the token exchange. */
export type TokenExchangeSupport = "available" | "unavailable" | "unknown";

/**
 * Ask Komodo Core whether it has a token exchange endpoint, without exchanging anything.
 *
 * Komodo has no way to simply ask, so an empty exchange request is sent. A Komodo with the
 * endpoint answers it with an OAuth error code (the request is malformed); one without it
 * answers as for any unknown route, or serves its web UI. Anything else — Komodo
 * unreachable, a gateway error, a rate limit, a proxy asking for credentials — says nothing
 * either way.
 */
export async function probeTokenExchange(komodoUrl: string): Promise<TokenExchangeSupport> {
  let response: Response;
  try {
    response = await postForm(
      tokenEndpoint(komodoUrl),
      { grant_type: TOKEN_EXCHANGE_GRANT },
      Math.min(config.KOMODO_API_TIMEOUT_MS, PROBE_TIMEOUT_MS),
    );
  } catch {
    return "unknown";
  }
  if (oauthErrorOf(await jsonObject(response))) return "available";
  return NO_SUCH_ENDPOINT.has(response.status) || response.ok ? "unavailable" : "unknown";
}

// ============================================================================
// Login
// ============================================================================

/** What a person is told when Komodo does not take over their sign-in. */
const Hints = {
  REFUSED:
    "Komodo did not accept this sign-in. Your Komodo account may not be linked to this provider yet — " +
    "sign in to Komodo itself through it once — or sign in here with a Komodo API key.",
  SECOND_FACTOR:
    "Your Komodo account asks for a second factor, which cannot be completed from here. " +
    "Sign in with a Komodo API key instead.",
  UNSUPPORTED:
    "This Komodo cannot take over a sign-in from an identity provider. Sign in with a Komodo API key instead.",
  DISABLED: "Your Komodo account is not enabled. Ask a Komodo administrator to enable it.",
} as const;

/**
 * Builds the decision for a completed provider sign-in: which Komodo user is this?
 *
 * @param komodoUrl - Komodo Core base URL
 * @param revalidate - Re-checks the resulting session whenever it is refreshed
 */
export function createSsoLogin(komodoUrl: string, revalidate: RevalidatePrincipal): UpstreamLoginConfig {
  return {
    revalidate,
    resolve: async (login: UpstreamLogin) => {
      const provider = login.provider.name;
      // Only an ID token can be exchanged: it is signed by the provider and names the client
      // it was issued to, which is what lets Komodo decide whether to trust it.
      if (login.idToken === undefined) throw new LoginDeniedError(Hints.UNSUPPORTED);

      let jwt: string;
      try {
        jwt = await exchangeIdTokenForKomodoJwt(komodoUrl, login.idToken);
      } catch (error) {
        if (!(error instanceof KomodoExchangeError)) throw error;
        if (error.kind === "unsupported") {
          logger.error("Komodo cannot exchange tokens of provider %s: %s", provider, error.detail);
          throw new LoginDeniedError(Hints.UNSUPPORTED);
        }
        logger.warn("Komodo refused a sign-in through provider %s: %s", provider, error.detail);
        throw new LoginDeniedError(
          /second factor|two[- ]?factor|2fa/i.test(error.detail) ? Hints.SECOND_FACTOR : Hints.REFUSED,
        );
      }

      try {
        const client = KomodoClient.connectWithJwt(komodoUrl, jwt);
        const context = await buildKomodoContext(client, { type: "jwt", jwt }, "sso");
        auditLogin(context, `provider:${provider}`);
        return komodoAuthInfo(context);
      } catch (error) {
        // Komodo issued the session and then turns the person away: their account is disabled.
        if (error instanceof AuthenticationError) throw new LoginDeniedError(Hints.DISABLED);
        throw error;
      }
    },
  };
}
