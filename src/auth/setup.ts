/**
 * MCP-server authentication setup.
 *
 * Wires every way a caller can prove who they are to the same outcome — a Komodo user with
 * that user's permissions:
 *
 * | Caller presents                                   | Where                         | Acts as                      |
 * |---------------------------------------------------|-------------------------------|------------------------------|
 * | Komodo username + password                        | login page                    | that Komodo user             |
 * | Komodo API key + secret                           | login page                    | the key's Komodo user        |
 * | Komodo API key + secret as OAuth client credentials | `POST /token`               | the key's Komodo user        |
 * | secret or key of a client registered in `[auth.clients]` | `POST /token`          | the `[komodo]` service account |
 * | Komodo API key + secret as request headers (opt-in) | every `/mcp` request        | the key's Komodo user        |
 * | a sign-in at an identity provider Komodo trusts   | login page                    | the Komodo user linked to it |
 *
 * There is deliberately no row without a credential: a caller the server cannot identify
 * gets nothing here (and, with authentication switched off, read-only tools at most).
 *
 * **Settings that work but are not documented for users.** The user docs cover what people
 * need to sign in: password, API key (login page, client credentials) and the opt-in headers.
 * The framework's other `[auth]` settings are honoured here but left out of those docs, and are
 * described in the framework's README instead: registered clients (`[auth.clients.*]`,
 * `MCP_AUTH_SERVICE_CLIENT_*`), identity providers (`[auth.providers.*]`, `MCP_AUTH_OIDC_*`,
 * waiting for a Komodo Core with token exchange), token lifetimes (`MCP_AUTH_*_TOKEN_TTL`),
 * and — both off unless switched on — client metadata documents (`MCP_AUTH_CLIENT_METADATA*`)
 * and DPoP (`MCP_AUTH_DPOP`).
 *
 * @module auth/setup
 */

import { createOAuthProvider, logAuditEvent, logger as baseLogger } from "mcp-server-framework";
import type {
  AuthInfo,
  AuthOptions,
  CallerInfo,
  ClientCredentialsConfig,
  LocalLoginConfig,
  OAuthProviderConfig,
  RegisteredClient,
  ResolvedAuthConfig,
  RevalidatePrincipal,
} from "mcp-server-framework";
import { getGlobalClient, KomodoClient } from "../client.js";
import { ToolScopes } from "../config/scopes.js";
import { AuthenticationError, ClientNotConfiguredError } from "../errors/index.js";
import { createApiKeyHeaderAuthenticator, verifyApiKey, type ApiKeyVerifier } from "./api-key-auth.js";
import {
  auditLogin,
  buildKomodoContext,
  komodoAuthInfo,
  komodoIdentity,
  type KomodoSessionContext,
} from "./komodo-identity.js";
import { komodoLoginPage } from "./login.js";
import { createSsoLogin, probeTokenExchange } from "./sso.js";

const logger = baseLogger.child({ component: "auth" });

// ============================================================================
// Login Methods
// ============================================================================

/** Login-method ids — also the values of the login form's `method` field. */
export const LoginMethods = { PASSWORD: "password", API_KEY: "api-key" } as const;

/**
 * Re-checks a session's principal against Komodo when its refresh token is used: the
 * credential must still be accepted and the user still enabled, and the session picks up
 * the user's current permissions. A rejected credential ends the session; an unreachable
 * Komodo does not (the error propagates and the client retries).
 */
function revalidateAgainstKomodo(komodoUrl: string): RevalidatePrincipal {
  return async (authInfo: AuthInfo, caller: CallerInfo): Promise<AuthInfo | null> => {
    const identity = komodoIdentity.read(authInfo);
    if (!identity || identity.credential.type === "service") return null;
    try {
      const client = KomodoClient.connectWithCredential(komodoUrl, identity.credential);
      return komodoAuthInfo(
        await buildKomodoContext(client, identity.credential, identity.method, { callerAddress: caller.remoteAddress }),
      );
    } catch (error) {
      if (error instanceof AuthenticationError) return null;
      throw error;
    }
  };
}

/** Sign in with a Komodo username and password (Komodo `local_auth`). */
function passwordLogin(komodoUrl: string): LocalLoginConfig {
  return {
    id: LoginMethods.PASSWORD,
    displayName: "Password",
    identifierLabel: "Username",
    secretLabel: "Password",
    verify: async (username, password, caller) => {
      try {
        const jwt = await KomodoClient.loginForJwt(komodoUrl, username, password, caller.remoteAddress);
        const client = KomodoClient.connectWithJwt(komodoUrl, jwt);
        const context = await buildKomodoContext(client, { type: "jwt", jwt }, "password", {
          callerAddress: caller.remoteAddress,
        });
        auditLogin(context, "login-page");
        return komodoAuthInfo(context);
      } catch (error) {
        if (error instanceof AuthenticationError) return null; // bad credentials / 2FA / disabled → reject
        throw error; // unexpected (e.g. Komodo unreachable) → surfaced as a server error
      }
    },
    revalidate: revalidateAgainstKomodo(komodoUrl),
  };
}

/** Sign in with a Komodo API key and secret — works for SSO-only and 2FA accounts too. */
function apiKeyLogin(komodoUrl: string): LocalLoginConfig {
  return {
    id: LoginMethods.API_KEY,
    displayName: "API key",
    identifierLabel: "API key",
    secretLabel: "API secret",
    verify: async (key, secret, caller) => {
      const context = await verifyApiKey(komodoUrl, key.trim(), secret.trim(), caller.remoteAddress);
      if (!context) return null;
      auditLogin(context, "login-page");
      return komodoAuthInfo(context);
    },
    revalidate: revalidateAgainstKomodo(komodoUrl),
  };
}

/**
 * Whether Komodo itself accepts username/password logins. When it does not (SSO-only
 * instances), offering the form would only produce failures.
 *
 * If Komodo cannot be asked right now, the form is offered: a login attempt then fails
 * with a clear message, whereas hiding the form would lock out password users for the
 * whole lifetime of this process.
 */
async function komodoOffersPasswordLogin(komodoUrl: string): Promise<boolean> {
  try {
    return (await KomodoClient.getLoginOptions(komodoUrl)).local;
  } catch (error) {
    logger.warn(
      "Could not read Komodo's login options (%s) — offering username/password sign-in anyway",
      error instanceof Error ? error.message : String(error),
    );
    return true;
  }
}

// ============================================================================
// Client Credentials
// ============================================================================

/** What {@link createClientAuthenticator} needs — injectable so the routing can be tested. */
export interface ClientAuthenticatorDeps {
  /** Verifies a Komodo API key/secret pair. */
  readonly verifyApiKey: ApiKeyVerifier;
  /** Resolves the session of the `[komodo]` service account for a registered client. */
  readonly serviceAccountContext: (clientId: string) => Promise<KomodoSessionContext>;
}

/**
 * Builds the `client_credentials` hook: decides which Komodo user a machine client acts as.
 *
 * - A **registered client** (its secret already verified by the framework) acts as the
 *   `[komodo]` service account, capped by the scopes configured for it.
 * - Any other client must be a **Komodo API key**: `client_id` is the key, `client_secret`
 *   the secret, and it acts as the user the key belongs to.
 *
 * Nothing else is recognised.
 */
export function createClientAuthenticator(deps: ClientAuthenticatorDeps): ClientCredentialsConfig["authenticate"] {
  return async ({ clientId, clientSecret, registered, purpose, caller }) => {
    // A client that only revokes a token it holds is not signing in: nothing is recorded as a login.
    const signingIn = purpose === "token";
    if (registered) {
      const context = await deps.serviceAccountContext(registered.id);
      if (signingIn) auditLogin(context, "client-credentials");
      return komodoAuthInfo(context);
    }

    if (clientSecret === undefined) return null;
    const context = await deps.verifyApiKey(clientId, clientSecret, caller.remoteAddress);
    if (!context) return null;
    if (signingIn) auditLogin(context, "client-credentials");
    return komodoAuthInfo(context);
  };
}

/** The `[komodo]` service account, as seen through the server's global connection. */
async function serviceAccountContext(clientId: string): Promise<KomodoSessionContext> {
  const client = getGlobalClient();
  if (!client) throw ClientNotConfiguredError.notConnected();
  return buildKomodoContext(client, { type: "service" }, "service-client", { oauthClientId: clientId });
}

/**
 * Registered clients are only usable when there is a service account for them to act as.
 * Without `[komodo]` credentials they are dropped — loudly — rather than left to fail on
 * every token request.
 */
function usableServiceClients(
  clients: readonly RegisteredClient[],
  serviceAccountConfigured: boolean,
): readonly RegisteredClient[] {
  if (clients.length === 0 || serviceAccountConfigured) return clients;

  logger.error(
    "SECURITY: %d client(s) are registered under [auth.clients] (%s), but no [komodo] service-account " +
      "credentials are configured for them to act as — these clients are disabled",
    clients.length,
    clients.map((client) => client.id).join(", "),
  );
  logAuditEvent({
    category: "config",
    action: "service_clients_disabled",
    outcome: "denied",
    detail: { reason: "missing_komodo_credentials", clients: clients.map((client) => client.id) },
  });
  return [];
}

/** How a provider is named in logs: its kind, and for OIDC where it lives. */
function describeProvider(provider: OAuthProviderConfig): string {
  return provider.type === "oidc" ? `oidc: ${provider.issuer}` : provider.type;
}

/**
 * The identity providers people can sign in through — those of the configured ones that
 * Komodo can take a sign-in over from.
 *
 * A sign-in at a provider becomes a Komodo session by exchanging the provider's ID token at
 * Komodo Core (see `./sso.ts`). That takes a provider that issues ID tokens, and a Komodo
 * Core that has the exchange. Where either is missing the provider is left out — and the
 * operator who configured it hears at start-up why, and which way does work, rather than
 * finding a login page without the button they expected.
 */
async function usableSignInProviders(
  komodoUrl: string,
  providers: ResolvedAuthConfig["providers"],
): Promise<OAuthProviderConfig[]> {
  if (providers.length === 0) return [];

  const ignored = (list: readonly OAuthProviderConfig[], reason: string): void => {
    logAuditEvent({
      category: "config",
      action: "auth_providers_ignored",
      outcome: "info",
      detail: { providers: list.map((provider) => provider.type), reason },
    });
  };
  const apiKeyAdvice =
    "People whose Komodo account signs in through such a provider authenticate here with a Komodo API key " +
    "(login page, OAuth client credentials or the opt-in API-key headers).";

  const issuesIdTokens = (provider: OAuthProviderConfig): boolean =>
    provider.type === "oidc" || provider.type === "google";
  const withIdTokens = providers.filter(issuesIdTokens);
  const without = providers.filter((provider) => !issuesIdTokens(provider));
  if (without.length > 0) {
    logger.warn(
      "Sign-in through %s is configured but cannot be offered: Komodo takes a sign-in over from OpenID Connect " +
        "providers only, because it needs their signed ID token. %s",
      without.map(describeProvider).join(", "),
      apiKeyAdvice,
    );
    ignored(without, "no_id_token");
  }
  if (withIdTokens.length === 0) return [];

  const names = withIdTokens.map(describeProvider).join(", ");
  const support = await probeTokenExchange(komodoUrl);
  if (support === "unavailable") {
    logger.warn(
      "Sign-in through %s is configured but cannot be offered: this Komodo Core has no token exchange " +
        "(POST /auth/token), which is how a sign-in at a provider becomes a Komodo session. %s",
      names,
      apiKeyAdvice,
    );
    ignored(withIdTokens, "komodo_token_exchange_unavailable");
    return [];
  }
  if (support === "unknown") {
    logger.warn("Could not ask Komodo whether it offers token exchange — offering sign-in through %s anyway", names);
  }
  return withIdTokens;
}

// ============================================================================
// Setup
// ============================================================================

/** Input of {@link createKomodoAuth}. */
export interface KomodoAuthSetupOptions {
  /** Komodo Core base URL. */
  readonly komodoUrl: string;
  /** Public base URL of this MCP server (OAuth issuer). */
  readonly serverUrl: string;
  /** The resolved `[auth]` configuration. */
  readonly config: ResolvedAuthConfig;
  /** Whether `[komodo]` credentials are configured (the service account for registered clients). */
  readonly serviceAccountConfigured: boolean;
}

/** Result of {@link createKomodoAuth}. */
export interface KomodoAuthSetup {
  /** Auth options for `createServer()`. */
  readonly auth: AuthOptions;
  /** Whether registered service clients are active — they need the global Komodo connection. */
  readonly serviceClients: boolean;
}

/**
 * Create the MCP server's authentication: the OAuth authorization server with its login
 * methods and the `client_credentials` grant, plus the opt-in API-key headers.
 *
 * @throws When the OAuth provider cannot be initialised — the caller fails closed.
 */
export async function createKomodoAuth(options: KomodoAuthSetupOptions): Promise<KomodoAuthSetup> {
  const { komodoUrl, serverUrl, config } = options;

  const signInProviders = await usableSignInProviders(komodoUrl, config.providers);
  const offerPassword = await komodoOffersPasswordLogin(komodoUrl);
  const localLogin = [...(offerPassword ? [passwordLogin(komodoUrl)] : []), apiKeyLogin(komodoUrl)];
  if (!offerPassword) {
    logger.info("Komodo has username/password login disabled — the login page offers API-key sign-in only");
  }

  const serviceClients = usableServiceClients(config.clients, options.serviceAccountConfigured);

  // A provider is not contacted here: it is looked up when a sign-in first needs it, so one
  // that starts alongside this server — or is briefly down — does not hold up the start.
  const oauth = await createOAuthProvider(signInProviders, {
    serverUrl,
    localLogin,
    ...(signInProviders.length > 0 && {
      upstreamLogin: createSsoLogin(komodoUrl, revalidateAgainstKomodo(komodoUrl)),
    }),
    clientCredentials: {
      clients: serviceClients,
      authenticate: createClientAuthenticator({
        verifyApiKey: (key, secret, callerAddress) => verifyApiKey(komodoUrl, key, secret, callerAddress),
        serviceAccountContext,
      }),
    },
    // Applications that identify themselves by a web address, and tokens bound to a key of
    // the client: both describe the MCP client, not who is signed in — every way in above
    // still ends at a Komodo user.
    clientMetadata: config.clientMetadata,
    dpop: config.dpop,
    accessTokenTtlMs: config.accessTokenTtlMs,
    refreshTokenTtlMs: config.refreshTokenTtlMs,
    renderLoginPage: komodoLoginPage,
  });

  if (config.apiKeyHeader) {
    logger.warn(
      "SECURITY: API-key header authentication is enabled — /mcp accepts X-Api-Key / X-Api-Secret in place " +
        "of an OAuth token. The secret travels with every request: expose the endpoint over TLS or an " +
        "encrypted network only.",
    );
    logAuditEvent({ category: "config", action: "api_key_header_enabled", outcome: "info" });
  }

  logger.info(
    "MCP authentication enabled — sign-in: %s | client credentials: Komodo API keys%s | API-key headers: %s",
    [...signInProviders.map(describeProvider), ...localLogin.map((method) => method.displayName)].join(" + "),
    serviceClients.length > 0 ? ` + ${serviceClients.length} registered client(s)` : "",
    config.apiKeyHeader ? "on" : "off",
  );
  // Both are off unless switched on. Once one is on, it is said at start-up, because looking
  // up an application's web address has a requirement an operator cannot see from the
  // outside: outbound HTTPS.
  if (config.clientMetadata !== false || config.dpop) {
    const acceptedHosts = config.clientMetadata === false ? undefined : config.clientMetadata.allowedHosts;
    logger.info(
      "MCP clients — introduce themselves by web address: %s | tokens tied to the client (DPoP): %s",
      config.clientMetadata === false
        ? "off (clients register)"
        : `on, from ${acceptedHosts ? acceptedHosts.join(", ") : "any website"} (needs outbound HTTPS; MCP_AUTH_CLIENT_METADATA=false turns it off)`,
      config.dpop ? "on" : "off",
    );
  }

  return {
    auth: {
      enabled: true,
      ...oauth.authOptions,
      issuerUrl: new URL(serverUrl),
      scopesSupported: Object.values(ToolScopes),
      ...(config.apiKeyHeader && {
        requestAuthenticators: [
          createApiKeyHeaderAuthenticator((key, secret, callerAddress) =>
            verifyApiKey(komodoUrl, key, secret, callerAddress),
          ),
        ],
      }),
      // Show each signed-in user only the tools their Komodo permissions actually
      // allow. Scopes are derived from real Komodo permissions, so without this a
      // read-only user is offered every write tool and gets a refusal on each —
      // wasted context and a misleading tool list. Anonymous callers are already
      // filtered this way via `anonymousScopes`; this closes the gap for
      // authenticated ones. Call-time enforcement is unaffected either way.
      scopeFilterCapabilities: true,
    },
    serviceClients: serviceClients.length > 0,
  };
}
