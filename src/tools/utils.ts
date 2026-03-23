/**
 * Tool Utilities
 *
 * Common utilities for MCP tool handlers including client validation,
 * error wrapping, and cancellation handling.
 *
 * @module tools/utils
 */

import type { KomodoClient } from "../client.js";
import { ClientNotConfiguredError, ApiError, ConnectionError, AuthenticationError } from "../errors/index.js";
import { OperationCancelledError } from "mcp-server-framework";
import { komodoConnectionManager, extractKomodoError } from "../client.js";

/** Connection-related Node.js error codes */
const CONNECTION_ERROR_CODES = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ERR_NETWORK"]);

/** Timeout-related Node.js error codes */
const TIMEOUT_ERROR_CODES = new Set(["ECONNABORTED", "UND_ERR_CONNECT_TIMEOUT"]);

/**
 * Returns the connected Komodo client.
 * Throws ClientNotConfiguredError with a state-aware message if not connected.
 */
export function requireClient(): KomodoClient {
  const client = komodoConnectionManager.getClient();
  if (!client) {
    throw komodoConnectionManager.getState() === "disconnected"
      ? ClientNotConfiguredError.notConfigured()
      : ClientNotConfiguredError.notConnected();
  }
  return client;
}

/**
 * Checks if an operation was cancelled via AbortSignal.
 */
export function checkCancelled(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) {
    throw new OperationCancelledError(operation);
  }
}

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
      if (status === 403) {
        throw AuthenticationError.forbidden();
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

/**
 * Extract the MongoDB ObjectId string from a Komodo Update object.
 */
export function extractUpdateId(update: { _id?: { $oid?: string } }): string {
  return update._id?.$oid || "unknown";
}
