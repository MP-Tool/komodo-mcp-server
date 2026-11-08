/**
 * Komodo API-key authentication.
 *
 * A Komodo API key belongs to a user (or a service user) and carries that user's
 * permissions. Presenting one to the MCP server is therefore a complete way to
 * authenticate: the server asks Komodo whose key it is and the session acts as that user
 * — never as more.
 *
 * The same verification backs every place a key can be presented:
 * - the **API key** tab of the login page,
 * - the OAuth **`client_credentials`** grant (`client_id` = key, `client_secret` = secret),
 * - the opt-in **`X-Api-Key` / `X-Api-Secret`** request headers.
 *
 * @module auth/api-key-auth
 */

import crypto from "node:crypto";
import type { RequestAuthenticator } from "mcp-server-framework";
import { KomodoClient } from "../client.js";
import { AuthenticationError } from "../errors/index.js";
import { buildKomodoContext, komodoAuthInfo, type KomodoSessionContext } from "./komodo-identity.js";

// ============================================================================
// Format
// ============================================================================

// Komodo 2 mints keys as `K_<alphanumeric>_K` and secrets as `S_<alphanumeric>_S`. Komodo 1
// minted `K-<alphanumeric>` / `S-<alphanumeric>`, and a key created back then keeps working
// after an upgrade — Core looks keys up as stored, whatever their shape. Both generations are
// recognised (40 random characters today; Core makes the length configurable, so it is left
// open here).
const API_KEY_PATTERN = /^K(?:_[A-Za-z0-9]{16,128}_K|-[A-Za-z0-9]{16,128})$/;
const API_SECRET_PATTERN = /^S(?:_[A-Za-z0-9]{16,128}_S|-[A-Za-z0-9]{16,128})$/;

/** Whether `value` has the shape of a Komodo API key. */
export function isKomodoApiKey(value: string): boolean {
  return API_KEY_PATTERN.test(value);
}

/** Whether `value` has the shape of a Komodo API secret. */
export function isKomodoApiSecret(value: string): boolean {
  return API_SECRET_PATTERN.test(value);
}

// ============================================================================
// Verification
// ============================================================================

/**
 * Resolves the Komodo session an API key stands for, or `null` when it is not valid.
 * `callerAddress` is who presented the key — Komodo counts a failed check against it.
 */
export type ApiKeyVerifier = (
  key: string,
  secret: string,
  callerAddress: string | undefined,
) => Promise<KomodoSessionContext | null>;

/**
 * Verify a Komodo API key and secret against Komodo Core.
 *
 * Anything that is not shaped like a Komodo key is turned down without contacting Komodo.
 * Everything else is checked in the caller's name: Komodo rate-limits failed authentications
 * by client address, and the check tells it the caller's (see `forwardingHeaders`), so a
 * caller's failures count against that caller and not against everyone using this server.
 *
 * @param komodoUrl - Komodo Core base URL
 * @param key - The presented API key
 * @param secret - The presented API secret
 * @param callerAddress - Who presented the key: Komodo counts a failed check against that address
 * @returns The session context, or `null` when Komodo does not accept the pair
 * @throws {TooManyAttemptsError} when Komodo refuses further attempts for now
 * @throws {ConnectionError} when Komodo cannot be reached — not a verdict on the key
 */
export async function verifyApiKey(
  komodoUrl: string,
  key: string,
  secret: string,
  callerAddress: string | undefined,
): Promise<KomodoSessionContext | null> {
  if (!isKomodoApiKey(key) || !isKomodoApiSecret(secret)) return null;

  try {
    const client = KomodoClient.connectWithApiKey(komodoUrl, key, secret);
    return await buildKomodoContext(client, { type: "api-key", key, secret }, "api-key", { callerAddress });
  } catch (error) {
    if (error instanceof AuthenticationError) return null;
    throw error;
  }
}

// ============================================================================
// Request Headers (opt-in)
// ============================================================================

/** Komodo's own header names for API-key authentication. */
const KEY_HEADER = "x-api-key";
const SECRET_HEADER = "x-api-secret";

/**
 * How long a verified key is trusted before Komodo is asked again. Every request carries
 * the headers, so without this each MCP call would cost two extra Komodo round-trips. The
 * window bounds how long a changed permission set goes unnoticed at the MCP layer; a deleted
 * key stops working immediately regardless, because Komodo rejects it on the actual API call.
 */
const VERIFIED_KEY_TTL_MS = 60_000;
const VERIFIED_KEY_CACHE_MAX = 1_000;

interface VerifiedKey {
  readonly context: KomodoSessionContext;
  readonly expiresAt: number;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Create the request authenticator for `X-Api-Key` / `X-Api-Secret`.
 *
 * Only failed verifications reach Komodo more than once a minute; positive results are kept
 * briefly, keyed by a digest of the pair so the cache itself never holds a usable lookup key.
 *
 * @param verify - Verifies a key/secret pair (see {@link verifyApiKey})
 * @param now - Clock, injectable for tests
 */
export function createApiKeyHeaderAuthenticator(
  verify: ApiKeyVerifier,
  now: () => number = Date.now,
): RequestAuthenticator {
  const verified = new Map<string, VerifiedKey>();

  /** Store an entry, evicting the oldest once full (`Map` keeps insertion order). */
  function remember(cacheKey: string, entry: VerifiedKey): void {
    if (verified.size >= VERIFIED_KEY_CACHE_MAX && !verified.has(cacheKey)) {
      const oldest = verified.keys().next();
      if (!oldest.done) verified.delete(oldest.value);
    }
    verified.set(cacheKey, entry);
  }

  return {
    name: "komodo-api-key",

    // Key and secret are verified together, so together they are the credential. A key that
    // arrives without a secret is still this scheme's to refuse.
    credential(headers) {
      const key = headerValue(headers[KEY_HEADER]);
      return key === undefined ? undefined : `${key}\0${headerValue(headers[SECRET_HEADER]) ?? ""}`;
    },

    async authenticate(headers, caller) {
      const key = headerValue(headers[KEY_HEADER]);
      const secret = headerValue(headers[SECRET_HEADER]);
      if (!key || !secret) return null;

      const cacheKey = crypto.createHash("sha256").update(`${key}\0${secret}`).digest("base64url");
      const cached = verified.get(cacheKey);
      if (cached && cached.expiresAt > now()) return komodoAuthInfo(cached.context);

      const context = await verify(key, secret, caller.remoteAddress);
      if (!context) {
        verified.delete(cacheKey);
        return null;
      }
      remember(cacheKey, { context, expiresAt: now() + VERIFIED_KEY_TTL_MS });
      return komodoAuthInfo(context);
    },
  };
}
