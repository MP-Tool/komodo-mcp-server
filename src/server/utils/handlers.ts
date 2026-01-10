/**
 * MCP Protocol Handlers
 *
 * Sets up notification and request handlers for MCP protocol features:
 * - Cancellation: Handle cancelled request notifications
 * - Ping/Pong: Respond to liveness checks
 *
 * @module server/handlers
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CancelledNotificationSchema, PingRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger, requestManager, mcpLogger } from '../../utils/index.js';

/**
 * Sets up the cancellation notification handler.
 *
 * Per MCP Spec 2025-11-25:
 * - Receivers SHOULD stop processing the cancelled request
 * - Receivers SHOULD free associated resources
 * - Receivers SHOULD NOT send a response for the cancelled request
 * - Invalid cancellation notifications SHOULD be ignored
 *
 * @param server - The McpServer instance
 */
export function setupCancellationHandler(server: McpServer): void {
  server.server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
    const { requestId, reason } = notification.params;

    // Per spec: requestId is required for cancellation
    if (requestId === undefined) {
      logger.debug('Cancellation ignored: no requestId provided');
      return;
    }

    logger.info('Cancellation received: requestId=%s reason=%s', requestId, reason || 'none');

    // Delegate to request manager
    const cancelled = requestManager.handleCancellation(requestId, reason);

    if (!cancelled) {
      // Per spec: Invalid cancellation notifications SHOULD be ignored
      logger.debug('Cancellation ignored: request not found or already completed');
    }
  });

  logger.debug('Cancellation handler registered');
}

/**
 * Sets up a ping request handler that responds with pong and logs via MCP notification.
 *
 * Per MCP Spec: ping is a standard request that servers should respond to.
 * We extend this by logging a "pong" notification to demonstrate bidirectional communication.
 *
 * @param server - The McpServer instance
 */
export function setupPingHandler(server: McpServer): void {
  server.server.setRequestHandler(PingRequestSchema, async () => {
    // Log pong via MCP notification (info level)
    mcpLogger.info('🏓 pong').catch(() => {
      // Ignore errors if client disconnected
    });

    logger.debug('Received ping, sent pong');

    // Return empty object as per MCP spec
    return {};
  });

  logger.debug('Ping handler registered');
}
