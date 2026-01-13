/**
 * Cancellation Handler
 *
 * Handles cancelled request notifications per MCP Specification 2025-11-25.
 *
 * Per MCP Spec:
 * - Receivers SHOULD stop processing the cancelled request
 * - Receivers SHOULD free associated resources
 * - Receivers SHOULD NOT send a response for the cancelled request
 * - Invalid cancellation notifications SHOULD be ignored
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation
 * @module server/handlers/cancellation
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { CancelledNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger as baseLogger } from '../../utils/index.js';
import { requestManager } from '../lifecycle/index.js';
import type { HandlerDefinition, CancellationParams } from './core/index.js';
import {
  HANDLER_NAMES,
  HANDLER_LOG_COMPONENTS,
  MCP_SPEC_URLS,
  MCP_SPEC_VERSION,
  HandlerLogMessages,
} from './core/index.js';

const logger = baseLogger.child({ component: HANDLER_LOG_COMPONENTS.CANCELLATION });

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * Sets up the cancellation notification handler.
 *
 * Registers a handler that processes cancellation notifications from clients.
 * Delegates actual cancellation logic to the RequestManager.
 *
 * @param server - The McpServer instance
 */
export function setupCancellationHandler(server: McpServer): void {
  server.server.setNotificationHandler(CancelledNotificationSchema, async (notification) => {
    const { requestId, reason } = notification.params as CancellationParams;

    // Per spec: requestId is required for cancellation
    if (requestId === undefined) {
      logger.debug(HandlerLogMessages.CANCELLATION_IGNORED_NO_ID);
      return;
    }

    logger.info(HandlerLogMessages.CANCELLATION_RECEIVED, requestId, reason ?? 'none');

    // Delegate to request manager
    const cancelled = requestManager.handleCancellation(requestId, reason);

    if (!cancelled) {
      // Per spec: Invalid cancellation notifications SHOULD be ignored
      logger.debug(HandlerLogMessages.CANCELLATION_IGNORED_NOT_FOUND);
    }
  });

  logger.debug(HandlerLogMessages.HANDLER_REGISTERED, HANDLER_NAMES.CANCELLATION);
}

// ============================================================================
// Handler Definition
// ============================================================================

/**
 * Cancellation handler definition with metadata.
 *
 * Use this for programmatic handler registration via HandlerRegistry.
 */
export const cancellationHandler: HandlerDefinition = {
  metadata: {
    name: HANDLER_NAMES.CANCELLATION,
    type: 'notification',
    description: 'Handles request cancellation notifications from clients',
    specUrl: MCP_SPEC_URLS.CANCELLATION,
    specVersion: MCP_SPEC_VERSION,
  },
  setup: setupCancellationHandler,
};
