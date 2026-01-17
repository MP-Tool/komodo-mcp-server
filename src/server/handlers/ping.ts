/**
 * Ping Handler
 *
 * Handles ping/pong liveness checks per MCP Specification.
 *
 * Per MCP Spec:
 * - Ping is a standard request that servers SHOULD respond to
 * - Response is an empty object
 * - Used for connection health checks
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/ping
 * @module server/handlers/ping
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PingRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { logger as baseLogger, mcpLogger } from '../logger/index.js';
import type { HandlerDefinition, PingResult } from './core/index.js';
import {
  HANDLER_NAMES,
  HANDLER_LOG_COMPONENTS,
  MCP_SPEC_URLS,
  MCP_SPEC_VERSION,
  HandlerLogMessages,
} from './core/index.js';

const logger = baseLogger.child({ component: HANDLER_LOG_COMPONENTS.PING });

// ============================================================================
// Handler Implementation
// ============================================================================

/**
 * Sets up the ping request handler.
 *
 * Registers a handler that responds to ping requests with an empty object
 * and logs a "pong" notification via MCP for demonstration of bidirectional
 * communication.
 *
 * @param server - The McpServer instance
 */
export function setupPingHandler(server: McpServer): void {
  server.server.setRequestHandler(PingRequestSchema, async (): Promise<PingResult> => {
    // Log pong via MCP notification (demonstrates server -> client communication)
    mcpLogger.info(HandlerLogMessages.PONG_SENT).catch(() => {
      // Ignore errors if client disconnected
    });

    logger.debug(HandlerLogMessages.PING_RECEIVED);

    // Return empty object as per MCP spec
    return {};
  });

  logger.debug(HandlerLogMessages.HANDLER_REGISTERED, HANDLER_NAMES.PING);
}

// ============================================================================
// Handler Definition
// ============================================================================

/**
 * Ping handler definition with metadata.
 *
 * Use this for programmatic handler registration via HandlerRegistry.
 */
export const pingHandler: HandlerDefinition = {
  metadata: {
    name: HANDLER_NAMES.PING,
    type: 'request',
    description: 'Responds to ping requests with pong for liveness checks',
    specUrl: MCP_SPEC_URLS.PING,
    specVersion: MCP_SPEC_VERSION,
  },
  setup: setupPingHandler,
};
