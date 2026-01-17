/**
 * Generic Tool Context Types
 *
 * Framework-agnostic tool context interface that works with any API client.
 *
 * @module server/types/tool-context
 */

import type { IApiClient } from './client.js';

// ============================================================================
// Progress Reporting Types
// ============================================================================

/**
 * Progress data for long-running operations.
 *
 * @see MCP Specification - Progress Notifications
 */
export interface ProgressData {
  /** Current progress value (must be <= total if total is set) */
  readonly progress: number;

  /** Total expected value (optional - omit for indeterminate progress) */
  readonly total?: number;

  /** Optional human-readable message */
  readonly message?: string;
}

/**
 * Progress reporter function type.
 *
 * @param data - Progress data to report
 * @returns true if sent successfully, false if not available or rate-limited
 */
export type ProgressReporter = (data: ProgressData) => Promise<boolean>;

// ============================================================================
// Tool Context Interface
// ============================================================================

/**
 * Generic context passed to tool handlers.
 *
 * This interface provides tools with:
 * - Access to the authenticated API client
 * - Ability to update the client (for configuration tools)
 * - Progress reporting for long-running operations
 * - AbortSignal for cancellation support
 *
 * @typeParam TClient - The API client type (must implement IApiClient)
 *
 * @example
 * ```typescript
 * // Komodo-specific tool handler
 * async function myToolHandler(
 *   args: MyToolArgs,
 *   context: IToolContext<KomodoClient>
 * ): Promise<MyToolResult> {
 *   // Check cancellation
 *   if (context.abortSignal?.aborted) {
 *     throw new Error('Operation cancelled');
 *   }
 *
 *   // Use the client
 *   const client = context.client;
 *   if (!client) {
 *     throw new Error('Client not configured');
 *   }
 *
 *   // Report progress
 *   await context.reportProgress?.({ progress: 50, total: 100 });
 *
 *   return client.doSomething(args);
 * }
 * ```
 */
export interface IToolContext<TClient extends IApiClient = IApiClient> {
  /**
   * The authenticated API client instance.
   *
   * Will be `null` if:
   * - No client has been configured yet
   * - The client connection failed
   * - The client was disconnected
   *
   * Tools that require a client should check this and return
   * an appropriate error message if null.
   */
  readonly client: TClient | null;

  /**
   * Sets a new API client instance.
   *
   * This is used by configuration/connection tools to establish
   * or update the client connection. It:
   * - Updates the connection state
   * - Triggers tool availability changes
   * - Notifies MCP clients of capability changes
   *
   * @param client - The new client instance to set
   * @returns Promise that resolves when connection is established
   * @throws If health check fails or connection cannot be established
   */
  setClient: (client: TClient) => Promise<void>;

  /**
   * Reports progress for long-running operations.
   *
   * Only available if the MCP client requested progress via
   * `_meta.progressToken` in the tool call request.
   *
   * @param data - Progress data to report
   * @returns true if sent successfully, false if not available or rate-limited
   *
   * @example
   * ```typescript
   * // Determinate progress
   * await context.reportProgress?.({ progress: 50, total: 100 });
   *
   * // Indeterminate progress with message
   * await context.reportProgress?.({ progress: 1, message: 'Processing...' });
   * ```
   */
  reportProgress?: ProgressReporter;

  /**
   * AbortSignal that is triggered when the request is cancelled.
   *
   * Tools SHOULD check this signal periodically during long-running
   * operations and abort gracefully when triggered.
   *
   * @example
   * ```typescript
   * for (const item of items) {
   *   if (context.abortSignal?.aborted) {
   *     throw new Error('Operation cancelled');
   *   }
   *   await processItem(item);
   * }
   * ```
   */
  abortSignal?: AbortSignal;
}

// ============================================================================
// Tool Definition Types
// ============================================================================

/**
 * Tool handler function type.
 *
 * @typeParam TArgs - The tool's argument type
 * @typeParam TResult - The tool's result type
 * @typeParam TClient - The API client type
 */
export type ToolHandler<TArgs = unknown, TResult = unknown, TClient extends IApiClient = IApiClient> = (
  args: TArgs,
  context: IToolContext<TClient>,
) => Promise<TResult>;
