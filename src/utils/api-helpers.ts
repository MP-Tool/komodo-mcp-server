/**
 * API Helpers
 *
 * Low-level utilities for Komodo API interaction including client access,
 * cancellation checks, and error classification/wrapping.
 *
 * @module utils/api-helpers
 */

import { Types } from "komodo_client";
import type { KomodoClient } from "../client.js";
import {
  ClientNotConfiguredError,
  ApiError,
  ConnectionError,
  AuthenticationError,
  ConfirmationRequiredError,
  extractKomodoError,
} from "../errors/index.js";
import {
  OperationCancelledError,
  getCurrentToolContext,
  AuthorizationError,
  logAuditEvent,
  logger,
  elicitConfirmation,
} from "mcp-server-framework";
import { connectUserClient, getGlobalClient } from "../client.js";
import { komodoIdentity, meetsPermissionLevel } from "../auth/komodo-identity.js";
import { config } from "../config/index.js";

// ============================================================================
// Error Code Sets
// ============================================================================

/** Connection-related Node.js error codes */
const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ERR_NETWORK"]);

/** Timeout-related Node.js error codes */
const TIMEOUT_ERROR_CODES = new Set(["ECONNABORTED", "UND_ERR_CONNECT_TIMEOUT"]);

// ============================================================================
// Client Access
// ============================================================================

/**
 * Returns the Komodo client for the current tool call, resolved by operating mode.
 *
 * Reads the current tool context's auth (via AsyncLocalStorage, set by the framework
 * before each handler runs):
 * - **Authenticated** request → a client scoped to that user's minted Komodo JWT, built
 *   fresh from the request's own `auth.extra` so users are strictly isolated.
 * - **Anonymous** request (stdio, or HTTP with auth disabled) → the global service
 *   connection from the `[komodo]` credentials.
 *
 * Synchronous by design (no `await` at the ~80 call sites): the per-user client is a thin,
 * stateless JWT wrapper, and the global connection is already established at startup.
 */
export function requireClient(): KomodoClient {
  const auth = getCurrentToolContext()?.auth;
  const identity = komodoIdentity.read(auth);

  if (identity) {
    // Authenticated Komodo user → their own JWT-scoped client.
    return connectUserClient(identity.komodoJwt);
  }

  if (auth) {
    // Authenticated to the MCP server but no Komodo identity is bound. This should not
    // occur — the OAuth hooks deny sessions for users that don't exist in Komodo — so
    // treat it as a misconfiguration rather than silently falling back to global creds.
    throw ClientNotConfiguredError.notConfigured();
  }

  // Anonymous request → global service connection (stdio / auth-disabled HTTP).
  const client = getGlobalClient();
  if (!client) throw ClientNotConfiguredError.notConfigured();
  return client;
}

// ============================================================================
// Core Version (cached read)
// ============================================================================

/** Short-TTL cache of the connected core's version string, keyed by base URL. */
interface CachedCoreVersion {
  readonly version: string;
  readonly expiresAt: number;
}
const coreVersionCache = new Map<string, CachedCoreVersion>();
const CORE_VERSION_TTL_MS = 60_000;
const CORE_VERSION_CACHE_MAX = 1_000;

/**
 * Read the current tool call's connected Komodo core version string, cached
 * briefly per base URL.
 *
 * Resolves its own client via {@link requireClient} — same as every other guard
 * in this module — so callers don't thread a `KomodoClient` through just for
 * this check. Version guards (see `requireMinimalVersion` in `./version.js`)
 * call this on every gated tool invocation, so the cache keeps that to at most
 * one `GetVersion` round-trip per core per minute. Keyed by URL (not client
 * instance), so per-user clients pointing at the same server share the cache;
 * the short TTL lets a core upgrade take effect without a restart.
 */
export async function readCoreVersion(): Promise<string> {
  const komodo = requireClient();
  const now = Date.now();
  const cached = coreVersionCache.get(komodo.url);
  if (cached && cached.expiresAt > now) return cached.version;

  const version = await wrapApiCall("checkCoreVersion", () => komodo.client.core_version());
  if (coreVersionCache.size >= CORE_VERSION_CACHE_MAX) coreVersionCache.clear();
  coreVersionCache.set(komodo.url, { version, expiresAt: now + CORE_VERSION_TTL_MS });
  return version;
}

// ============================================================================
// Per-Resource Authorization (fail-early)
// ============================================================================

/** Short-TTL cache of the current user's permission level per resource (avoids an extra call per tool). */
interface CachedPermission {
  readonly level: Types.PermissionLevel;
  readonly expiresAt: number;
}
const permissionCache = new Map<string, CachedPermission>();
const PERMISSION_CACHE_TTL_MS = 30_000;
const PERMISSION_CACHE_MAX = 5_000;

/**
 * Enforce, **before** the actual API call, that the current authenticated user holds at
 * least `required` permission on `target` in Komodo. Throws a clear {@link AuthorizationError}
 * and writes a `permission.denied` audit entry when they don't.
 *
 * No-op for anonymous/global-connection requests (stdio / auth-disabled) — there is no
 * per-user identity to check; the global service account governs access in that mode.
 *
 * @param target - The Komodo resource (`{ type, id }`)
 * @param required - The minimum permission level the tool needs (Read / Execute / Write)
 */
export async function requireKomodoPermission(
  target: Types.ResourceTarget,
  required: Types.PermissionLevel,
): Promise<void> {
  const identity = komodoIdentity.read(getCurrentToolContext()?.auth);
  if (!identity) return; // anonymous / global mode — not per-user gated here

  const cacheKey = `${identity.komodoUserId}:${target.type}:${target.id}`;
  const now = Date.now();

  let level: Types.PermissionLevel;
  const cached = permissionCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    level = cached.level;
  } else {
    const client = requireClient();
    const result = await wrapApiCall(`check permission on ${target.type} '${target.id}'`, () =>
      client.client.read("GetPermission", { target }),
    );
    level = result.level;
    if (permissionCache.size >= PERMISSION_CACHE_MAX) permissionCache.clear();
    permissionCache.set(cacheKey, { level, expiresAt: now + PERMISSION_CACHE_TTL_MS });
  }

  if (!meetsPermissionLevel(level, required)) {
    logAuditEvent({
      category: "permission",
      action: "permission.denied",
      outcome: "denied",
      actor: { userId: identity.komodoUserId, username: identity.username },
      target: `${target.type}:${target.id}`,
      detail: { required, have: level, phase: "pre-check" },
    });
    throw new AuthorizationError(
      `Insufficient Komodo permission: ${target.type} '${target.id}' requires ${required}, but you have ${level}.`,
    );
  }
}

// ============================================================================
// Destructive-Action Confirmation (manual user approval via MCP elicitation)
// ============================================================================

/** Describes the destructive operation a confirmation prompt is asking about. */
export interface DestructiveConfirmationRequest {
  /** Verb shown to the user, e.g. "delete", "destroy", "run", "execute command on" */
  readonly action: string;
  /** Resource kind, e.g. "stack", "server", "resource sync" */
  readonly resourceType: string;
  /** Resource id or name the user should recognize */
  readonly resourceId: string;
  /** Optional extra line (e.g. the shell command, or a cascade warning) */
  readonly detail?: string | undefined;
}

/**
 * Require, **before** the actual API call, that the human operator manually confirms a
 * destructive operation via the client's MCP elicitation UI (accept + confirm checkbox).
 *
 * Policy (config-driven):
 * - `KOMODO_CONFIRM_DESTRUCTIVE=false` → no-op (feature disabled).
 * - Prompt declined / cancelled / timed out → throws {@link ConfirmationRequiredError}
 *   and writes a `confirmation.declined` audit entry. Never falls open.
 * - Client cannot prompt (no elicitation capability, stateless mode):
 *   `KOMODO_CONFIRM_FALLBACK=deny` (default) → throws + `confirmation.unavailable` audit;
 *   `KOMODO_CONFIRM_FALLBACK=allow` → executes with a warning + `confirmation.bypassed` audit.
 *
 * Unlike {@link requireKomodoPermission} this also applies to anonymous/global-mode
 * requests — confirmation is about the human at the client, not the Komodo identity.
 */
export async function requireDestructiveConfirmation(req: DestructiveConfirmationRequest): Promise<void> {
  if (!config.KOMODO_CONFIRM_DESTRUCTIVE) return;

  const identity = komodoIdentity.read(getCurrentToolContext()?.auth);
  const actor = { ...(identity && { userId: identity.komodoUserId, username: identity.username }) };
  const target = `${req.resourceType}:${req.resourceId}`;

  const message = [
    `⚠️ ${capitalize(req.action)} ${req.resourceType} "${req.resourceId}"?`,
    ...(req.detail ? [req.detail] : []),
    "This action is destructive and may not be reversible.",
  ].join("\n");

  const outcome = await elicitConfirmation({ message });

  switch (outcome) {
    case "accepted":
      return; // the framework's tool.call audit records the executed call

    case "unsupported":
      if (config.KOMODO_CONFIRM_FALLBACK === "allow") {
        logger.warn(
          "Destructive action executed WITHOUT user confirmation (client lacks elicitation, KOMODO_CONFIRM_FALLBACK=allow): %s %s",
          req.action,
          target,
        );
        logAuditEvent({
          category: "confirmation",
          action: "confirmation.bypassed",
          outcome: "info",
          actor,
          target,
          detail: { action: req.action, reason: "client lacks elicitation support" },
        });
        return;
      }
      logAuditEvent({
        category: "confirmation",
        action: "confirmation.unavailable",
        outcome: "denied",
        actor,
        target,
        detail: { action: req.action, fallback: config.KOMODO_CONFIRM_FALLBACK },
      });
      throw ConfirmationRequiredError.unavailable(req.action, req.resourceType, req.resourceId);

    case "declined":
    case "cancelled":
    case "timeout":
      logAuditEvent({
        category: "confirmation",
        action: "confirmation.declined",
        outcome: "denied",
        actor,
        target,
        detail: { action: req.action, outcome },
      });
      throw ConfirmationRequiredError.declined(req.action, req.resourceType, req.resourceId, outcome);
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ============================================================================
// Cancellation
// ============================================================================

/**
 * Checks if an operation was cancelled via AbortSignal.
 */
export function checkCancelled(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) {
    throw new OperationCancelledError(operation);
  }
}

// ============================================================================
// API Call Wrapper
// ============================================================================

/**
 * Extracts the HTTP status code from a komodo_client plain-object rejection.
 * Returns undefined if the error is not a komodo_client response.
 */
function getKomodoStatus(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const status = (error as Record<string, unknown>).status;
    if (typeof status === "number") return status;
  }
  return undefined;
}

/**
 * Extracts a Node.js error code from an Error instance, including nested cause chains.
 * Node.js fetch wraps the real error (ECONNREFUSED, etc.) in error.cause.
 */
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof Error) {
    const code = (error as Error & { code?: string }).code;
    if (code) return code;
    if (error.cause instanceof Error) {
      return (error.cause as Error & { code?: string }).code;
    }
  }
  return undefined;
}

/**
 * Detects a Komodo permission denial. Komodo returns these as HTTP 403, or — for several
 * resource checks — as HTTP 500 carrying a permission-related message.
 */
function isKomodoPermissionDenied(status: number, message: string): boolean {
  if (status === 403) return true;
  if (status >= 400) {
    return /does not have required permission|must have at least|permission denied|not authorized/i.test(message);
  }
  return false;
}

/**
 * Wraps an API call with error handling and cancellation support.
 *
 * Properly handles komodo_client rejections which are plain objects:
 * - HTTP errors: { status: 4xx|5xx, result: { error: "message", trace?: [...] } }
 * - Network errors: { status: 1, result: { error: "..." }, error: <Error> }
 */
export async function wrapApiCall<T>(operation: string, apiCall: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  checkCancelled(signal, operation);

  try {
    return await apiCall();
  } catch (error) {
    checkCancelled(signal, operation);

    // Already-typed errors pass through unchanged
    if (OperationCancelledError.isCancellation(error)) {
      throw new OperationCancelledError(operation);
    }
    if (error instanceof ApiError || error instanceof ConnectionError || error instanceof AuthenticationError) {
      throw error;
    }

    // komodo_client plain-object rejections
    const status = getKomodoStatus(error);
    if (status !== undefined) {
      const message = extractKomodoError(error);

      // Network failure (status === 1)
      if (status === 1) {
        throw ConnectionError.failed(operation, message);
      }
      // Authentication errors
      if (status === 401) {
        throw AuthenticationError.unauthorized();
      }
      // Permission denials — backstop for paths without a pre-check, list endpoints, or
      // group-permission cases. Komodo signals these as 403, or as 500 with a permission
      // message. Surface a clean MCP authorization error + audit entry instead of a raw 500.
      if (isKomodoPermissionDenied(status, message)) {
        const identity = komodoIdentity.read(getCurrentToolContext()?.auth);
        logAuditEvent({
          category: "permission",
          action: "permission.denied",
          outcome: "denied",
          actor: { ...(identity && { userId: identity.komodoUserId, username: identity.username }) },
          target: operation,
          detail: { status, phase: "backstop", message },
        });
        throw new AuthorizationError(`Komodo denied this operation — insufficient permissions: ${message}`);
      }
      // HTTP errors (4xx, 5xx)
      if (status >= 400) {
        throw ApiError.fromResponse(status, message);
      }
    }

    // Standard Error instances (e.g. from fetch or other Node.js APIs)
    if (error instanceof Error) {
      const code = getErrorCode(error);

      if (code && CONNECTION_ERROR_CODES.has(code)) {
        throw ConnectionError.failed(operation, `${code}: ${error.message}`);
      }
      if (code && TIMEOUT_ERROR_CODES.has(code)) {
        throw ConnectionError.timeout(operation);
      }
      if (error.message.includes("timeout") || error.name === "TimeoutError") {
        throw ConnectionError.timeout(operation);
      }

      throw ApiError.requestFailed(`${operation}: ${error.message}`);
    }

    throw ApiError.requestFailed(`${operation}: ${String(error)}`);
  }
}
