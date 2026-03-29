/**
 * Error Extraction Utilities
 *
 * Parsing and formatting of komodo_client rejections and Error cause chains.
 *
 * @module errors/extraction
 */

import { AuthenticationError } from "./classes.js";

/**
 * Formats an Error, walking the full cause chain for network errors.
 *
 * Node.js undici (built-in fetch) nests errors deeply:
 * TypeError("fetch failed") → SocketError("") → Error("connect ECONNREFUSED ...")
 * This function walks until it finds the deepest cause with a non-empty message.
 */
export function formatError(error: Error): string {
  let deepest = error;
  let current: unknown = error.cause;
  while (current instanceof Error) {
    if (current.message) deepest = current;
    current = current.cause;
  }
  return deepest === error ? error.message : `${error.message}: ${deepest.message}`;
}

/**
 * Extracts a readable error message from a komodo_client rejection.
 *
 * komodo_client rejects with two shapes:
 * - HTTP errors: plain object `{ status: 4xx|5xx, result: { error: "message", trace?: [...] } }`
 * - Network errors: plain object `{ status: 1, result: { error: "..." }, error: <Error> }`
 * - Standard Error instances for fetch/network failures
 */
export function extractKomodoError(error: unknown): string {
  if (error instanceof Error) return formatError(error);
  if (typeof error === "object" && error !== null) {
    const e = error as Record<string, unknown>;
    // Network error has .error as an Error instance
    if (e.error instanceof Error) return formatError(e.error);
    // HTTP error has .result.error as a string
    if (typeof e.result === "object" && e.result !== null) {
      const result = e.result as Record<string, unknown>;
      if (typeof result.error === "string") return result.error;
    }
    if (typeof e.status === "number") return `HTTP ${e.status}`;
  }
  return String(error);
}

// ============================================================================
// Auth Rejection Detection
// ============================================================================

/** Pattern matching auth-related error messages from Komodo API */
const AUTH_ERROR_PATTERN = /invalid.*(credential|login|password)|unauthorized|forbidden|did not find user/i;

/**
 * Detect auth failures from komodo_client rejections and wrapped errors.
 *
 * Checks multiple signals because the komodo_client rejection shape
 * may vary: plain object `{ status, result: { error } }`, Error instance,
 * or wrapped errors. Komodo may return 401/403 OR 500 with auth message.
 */
export function isAuthRejection(error: unknown): boolean {
  if (error instanceof AuthenticationError) return true;
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (obj.status === 401 || obj.status === 403) return true;
    if (typeof obj.result === "object" && obj.result !== null) {
      const resultError = (obj.result as Record<string, unknown>).error;
      if (typeof resultError === "string" && AUTH_ERROR_PATTERN.test(resultError)) return true;
    }
  }
  if (error instanceof Error && AUTH_ERROR_PATTERN.test(error.message)) return true;
  return false;
}
