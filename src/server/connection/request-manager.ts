/**
 * Request Manager
 *
 * Manages in-flight requests for cancellation and progress tracking.
 * Implements MCP Specification 2025-11-25 utilities:
 * - Cancellation: Track and cancel in-flight requests
 * - Progress: Send progress notifications for long-running operations
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { logger as baseLogger } from '../../utils/logger/logger.js';

// Import centralized types and constants from core
import type {
  RequestId,
  ProgressToken,
  ActiveRequest,
  ProgressData,
  ProgressReporter,
  RequestManagerStats,
} from './core/types.js';
import {
  REQUEST_MANAGER_CONFIG,
  CONNECTION_LOG_COMPONENTS,
  CONNECTION_NOTIFICATION_METHODS,
  RequestManagerLogMessages,
} from './core/constants.js';

const logger = baseLogger.child({ component: CONNECTION_LOG_COMPONENTS.REQUEST_MANAGER });

// Re-export types for backwards compatibility
export type { ProgressData } from './core/types.js';

/**
 * Manages in-flight requests for cancellation and progress tracking
 *
 * Features:
 * - Track active requests by ID
 * - Handle cancellation notifications
 * - Send progress notifications
 * - Rate limiting for progress notifications
 */
export class RequestManager {
  /** Map of request ID to active request data */
  private activeRequests = new Map<RequestId, ActiveRequest>();

  /** Last progress notification time per progress token */
  private lastProgressTime = new Map<ProgressToken, number>();

  /** Reference to the MCP server (high-level) for sending notifications */
  private server: McpServer | null = null;

  /**
   * Initializes the request manager with an MCP server instance
   * @param server - The MCP Server instance for sending notifications
   */
  setServer(server: McpServer): void {
    this.server = server;
    logger.debug(RequestManagerLogMessages.SERVER_SET);
  }

  /**
   * Registers a new request for tracking
   *
   * @param requestId - The JSON-RPC request ID
   * @param method - The method being called
   * @param progressToken - Optional progress token from _meta
   * @returns AbortSignal to check for cancellation
   */
  registerRequest(requestId: RequestId, method: string, progressToken?: ProgressToken): AbortSignal {
    const abortController = new AbortController();

    this.activeRequests.set(requestId, {
      requestId,
      method,
      abortController,
      progressToken,
      startedAt: new Date(),
    });

    logger.debug(RequestManagerLogMessages.REQUEST_REGISTERED(requestId, method));

    return abortController.signal;
  }

  /**
   * Unregisters a completed request
   *
   * @param requestId - The JSON-RPC request ID
   */
  unregisterRequest(requestId: RequestId): void {
    const request = this.activeRequests.get(requestId);
    if (request) {
      this.activeRequests.delete(requestId);

      // Clean up progress tracking
      if (request.progressToken) {
        this.lastProgressTime.delete(request.progressToken);
      }

      logger.debug(RequestManagerLogMessages.REQUEST_UNREGISTERED(requestId));
    }
  }

  /**
   * Handles a cancellation notification from the client
   *
   * Per MCP Spec:
   * - Receivers SHOULD stop processing the cancelled request
   * - Receivers SHOULD free associated resources
   * - Receivers SHOULD NOT send a response for the cancelled request
   *
   * @param requestId - The ID of the request to cancel
   * @param reason - Optional reason for cancellation
   * @returns true if the request was found and cancelled, false otherwise
   */
  handleCancellation(requestId: RequestId, reason?: string): boolean {
    const request = this.activeRequests.get(requestId);

    if (!request) {
      // Per spec: Invalid cancellation notifications SHOULD be ignored
      logger.debug(RequestManagerLogMessages.REQUEST_NOT_FOUND(requestId));
      return false;
    }

    logger.info(RequestManagerLogMessages.CANCELLATION_REQUESTED(requestId, reason));

    // Signal cancellation via AbortController
    request.abortController.abort(reason || 'Request cancelled');

    // Clean up
    this.unregisterRequest(requestId);

    return true;
  }

  /**
   * Checks if a request has been cancelled
   *
   * @param requestId - The request ID to check
   * @returns true if the request was cancelled
   */
  isCancelled(requestId: RequestId): boolean {
    const request = this.activeRequests.get(requestId);
    return request?.abortController.signal.aborted ?? false;
  }

  /**
   * Gets the AbortSignal for a request
   *
   * @param requestId - The request ID
   * @returns The AbortSignal or undefined if not found
   */
  getAbortSignal(requestId: RequestId): AbortSignal | undefined {
    return this.activeRequests.get(requestId)?.abortController.signal;
  }

  /**
   * Sends a progress notification for a request
   *
   * Per MCP Spec:
   * - Progress value MUST increase with each notification
   * - Progress and total MAY be floating point
   * - Message SHOULD provide relevant human-readable progress information
   *
   * @param progressToken - The progress token from the original request
   * @param data - Progress data to send
   * @returns true if the notification was sent, false if rate limited or no server
   */
  async sendProgress(progressToken: ProgressToken, data: ProgressData): Promise<boolean> {
    if (!this.server) {
      logger.warn(RequestManagerLogMessages.PROGRESS_NO_SERVER);
      return false;
    }

    // Rate limiting: prevent flooding
    const now = Date.now();
    const lastTime = this.lastProgressTime.get(progressToken) || 0;

    if (now - lastTime < REQUEST_MANAGER_CONFIG.PROGRESS_MIN_INTERVAL_MS) {
      // Skip this notification (rate limited)
      return false;
    }

    this.lastProgressTime.set(progressToken, now);

    try {
      // Use the underlying low-level Server via the McpServer instance
      await this.server.server.notification({
        method: CONNECTION_NOTIFICATION_METHODS.PROGRESS,
        params: {
          progressToken,
          progress: data.progress,
          ...(data.total !== undefined && { total: data.total }),
          ...(data.message && { message: data.message }),
        },
      });

      logger.debug(RequestManagerLogMessages.PROGRESS_SENT(progressToken, data.progress));

      return true;
    } catch (error) {
      // Progress notifications are best-effort
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.debug(RequestManagerLogMessages.PROGRESS_ERROR(progressToken, errorMessage));
      return false;
    }
  }

  /**
   * Creates a progress reporter function for a specific request
   *
   * @param progressToken - The progress token from the request
   * @returns A function to report progress, or undefined if no token
   */
  createProgressReporter(progressToken?: ProgressToken): ProgressReporter | undefined {
    if (!progressToken) {
      return undefined;
    }

    return (data: ProgressData) => this.sendProgress(progressToken, data);
  }

  /**
   * Gets statistics about active requests
   */
  getStats(): RequestManagerStats {
    return {
      activeRequests: this.activeRequests.size,
      requestIds: Array.from(this.activeRequests.keys()),
    };
  }

  /**
   * Clears all tracked requests (for shutdown)
   */
  clear(): void {
    // Abort all active requests
    logger.debug(RequestManagerLogMessages.CLEAR_ALL(this.activeRequests.size));

    for (const [requestId, request] of this.activeRequests) {
      request.abortController.abort('Server shutting down');
      logger.debug(RequestManagerLogMessages.REQUEST_UNREGISTERED(requestId));
    }

    this.activeRequests.clear();
    this.lastProgressTime.clear();
    this.server = null;

    logger.debug(RequestManagerLogMessages.CLEARED);
  }
}

/** Singleton instance */
export const requestManager = new RequestManager();
