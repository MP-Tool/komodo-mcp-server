/**
 * Tool Utilities
 *
 * Common utilities for MCP tool handlers, including:
 * - Client validation with proper error types
 * - Error wrapping for API calls with tracing
 * - Cancellation handling
 * - Metrics collection
 *
 * @module tools/utils
 */

import type { KomodoClient } from '../../api/index.js';
import { ClientNotConfiguredError, ApiError, ConnectionError } from '../../errors/index.js';
import {
  OperationCancelledError,
  withSpan,
  getServerMetrics,
  isTelemetryEnabled,
  MCP_ATTRIBUTES,
} from '../../framework.js';
import { KOMODO_ATTRIBUTES } from '../../telemetry.js';

/**
 * Validates that the Komodo client is configured and returns it.
 * Throws ClientNotConfiguredError if not configured.
 *
 * @param client - The potentially null client
 * @param toolName - The name of the tool requesting the client
 * @returns The configured client
 * @throws {ClientNotConfiguredError} If client is not configured
 *
 * @example
 * ```typescript
 * const validClient = requireClient(context.client, 'komodo_list_servers');
 * const servers = await validClient.servers.list();
 * ```
 */
export function requireClient(client: KomodoClient | null, toolName: string): KomodoClient {
  if (!client) {
    throw new ClientNotConfiguredError(toolName);
  }
  return client;
}

/**
 * Checks if an operation was cancelled via AbortSignal.
 *
 * @param signal - The AbortSignal to check
 * @param operation - The name of the operation for error context
 * @throws {OperationCancelledError} If the signal is aborted
 *
 * @example
 * ```typescript
 * checkCancelled(abortSignal, 'listContainers');
 * ```
 */
export function checkCancelled(signal: AbortSignal | undefined, operation: string): void {
  if (signal?.aborted) {
    throw new OperationCancelledError(operation);
  }
}

/**
 * Wraps an API call with proper error handling, tracing, and metrics.
 * Converts generic errors to typed Komodo errors.
 *
 * When OpenTelemetry is enabled:
 * - Creates a span for the operation
 * - Records duration metrics
 * - Adds error attributes on failure
 *
 * @param operation - The name of the operation
 * @param apiCall - The API call to execute
 * @param signal - Optional abort signal for cancellation
 * @returns The result of the API call
 * @throws {OperationCancelledError} If cancelled
 * @throws {ConnectionError} If connection failed
 * @throws {ApiError} For other API errors
 *
 * @example
 * ```typescript
 * const containers = await wrapApiCall(
 *   'listContainers',
 *   () => client.containers.list(serverId),
 *   signal
 * );
 * ```
 */
export async function wrapApiCall<T>(operation: string, apiCall: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  // Check if already cancelled
  checkCancelled(signal, operation);

  const startTime = Date.now();

  // Execute with or without tracing based on config
  const executeCall = async (): Promise<T> => {
    try {
      const result = await apiCall();

      // Record success metrics
      const duration = Date.now() - startTime;
      getServerMetrics().recordRequest(operation, duration, true);

      return result;
    } catch (error) {
      // Record failure metrics
      const duration = Date.now() - startTime;
      getServerMetrics().recordRequest(operation, duration, false);

      // Check if cancelled during the call
      if (OperationCancelledError.isCancellation(error)) {
        throw new OperationCancelledError(operation);
      }

      // Handle connection errors
      if (error instanceof Error) {
        const errorCode = (error as { code?: string }).code;
        const isConnectionError =
          errorCode === 'ECONNREFUSED' ||
          errorCode === 'ECONNRESET' ||
          errorCode === 'ENOTFOUND' ||
          errorCode === 'ERR_NETWORK';

        if (isConnectionError) {
          throw ConnectionError.failed(operation, `Connection error: ${errorCode}`);
        }

        // Check for timeout
        if (errorCode === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw ConnectionError.timeout(operation);
        }
      }

      // Wrap as ApiError
      if (error instanceof Error) {
        throw new ApiError(`${operation} failed: ${error.message}`, {
          cause: error,
          context: { operation },
        });
      }

      throw new ApiError(`${operation} failed: Unknown error`, {
        context: { operation, error },
      });
    }
  };

  // Use tracing if enabled
  if (isTelemetryEnabled()) {
    return withSpan(
      `komodo.api.${operation}`,
      async (span) => {
        span.setAttribute(MCP_ATTRIBUTES.OPERATION, operation);
        span.setAttribute(KOMODO_ATTRIBUTES.RESOURCE_TYPE, 'api');
        return executeCall();
      },
      { attributes: { [MCP_ATTRIBUTES.OPERATION]: operation } },
    );
  }

  return executeCall();
}

/**
 * Helper type for tool handler results
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Creates a successful text response.
 *
 * @param text - The response text
 * @returns A tool result with text content
 */
export function successResponse(text: string): ToolResult {
  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * Creates an error response.
 *
 * @param message - The error message
 * @returns A tool result with error flag
 */
export function errorResponse(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
