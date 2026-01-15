/**
 * SSE Transport Routes
 *
 * Legacy HTTP+SSE Transport routes (deprecated protocol 2024-11-05)
 * Still supported for backwards compatibility with older MCP clients.
 *
 * Endpoints:
 * - GET /sse → Opens SSE stream, sends endpoint event with message URL
 * - POST /message?sessionId=xxx → Receives JSON-RPC messages
 * - POST /mcp/message?sessionId=xxx → Alternative message endpoint (for /mcp SSE)
 *
 * @module server/transport/sse/routes
 */

import { Router, Request, Response } from 'express';
import { SseTransport } from './transport.js';
import { createJsonRpcError, JsonRpcErrorCode } from '../utils/index.js';
import { logger as baseLogger } from '../../logger/index.js';
import { HttpStatus, TransportErrorMessage } from '../../errors/index.js';
import { config, LEGACY_SSE_MAX_SESSIONS } from '../../../config/index.js';
import type { McpServerFactory } from './types.js';
import { TRANSPORT_LOG_COMPONENTS } from '../core/index.js';

const logger = baseLogger.child({ component: TRANSPORT_LOG_COMPONENTS.SSE });

// Store active SSE transports by session ID (separate from Streamable HTTP sessions)
const sseTransports = new Map<string, SseTransport>();

/**
 * Get the number of active SSE sessions
 */
export function getSseSessionCount(): number {
  return sseTransports.size;
}

// Backwards compatibility alias
export { getSseSessionCount as getLegacySseSessionCount };

/**
 * Close all active SSE sessions
 */
export async function closeAllSseSessions(): Promise<void> {
  /* v8 ignore start - requires real SSE sessions that cannot be mocked */
  if (sseTransports.size === 0) return;
  logger.info('Closing %d SSE sessions', sseTransports.size);
  const closePromises = Array.from(sseTransports.values()).map((transport) =>
    transport.close().catch((err) => logger.error('Error closing SSE transport: %s', err)),
  );
  await Promise.all(closePromises);
  sseTransports.clear();
  /* v8 ignore stop */
}

// Backwards compatibility alias
export { closeAllSseSessions as closeAllLegacySseSessions };

/**
 * Check if SSE mode is enabled
 */
export function isSseEnabled(): boolean {
  return config.MCP_LEGACY_SSE_ENABLED;
}

// Backwards compatibility alias
export { isSseEnabled as isLegacySseEnabled };

/**
 * Handle an SSE connection (shared logic for /mcp and /sse endpoints)
 *
 * Creates an SSE stream and connects the MCP server to it.
 * The messageEndpoint parameter determines where clients should POST messages to.
 *
 * Note: mcpServer.connect() automatically calls transport.start() internally,
 * which sends the 'endpoint' SSE event with the message URL containing the sessionId.
 *
 * NOTE: This function requires real SSE connections for full test coverage.
 * The internal event handlers (onclose, req.on('close'), mcpServer.connect error)
 * are exercised during integration testing.
 */
/* v8 ignore start - SSE requires real SSE connections for testing */
export async function handleSseConnection(
  req: Request,
  res: Response,
  mcpServerFactory: McpServerFactory,
  messageEndpoint: string,
): Promise<void> {
  // Check session limit to prevent memory exhaustion
  if (sseTransports.size >= LEGACY_SSE_MAX_SESSIONS) {
    logger.warn('SSE session limit reached (%d), rejecting connection', LEGACY_SSE_MAX_SESSIONS);
    res
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, TransportErrorMessage.TOO_MANY_SESSIONS));
    return;
  }

  try {
    // Create our custom SSE transport
    const transport = new SseTransport(messageEndpoint, res);

    // Start the transport first (sends endpoint event with sessionId)
    await transport.start();

    // Get the sessionId that was sent to the client in the endpoint event
    const sessionId = transport.sessionId;

    // IMPORTANT: Store transport BEFORE connecting MCP server!
    // mcpServer.connect() may wait for the initialize message, but the client
    // needs the session to be registered before it can send messages.
    sseTransports.set(sessionId, transport);
    logger.info('SSE session created: %s', sessionId);

    // Handle cleanup when connection closes
    transport.onclose = () => {
      logger.info('SSE session closed: %s', sessionId);
      sseTransports.delete(sessionId);
    };

    // Also handle request close/error
    req.on('close', () => {
      logger.debug('SSE request closed: %s', sessionId);
      transport.close().catch((err) => logger.error('Error closing SSE transport: %s', err));
      sseTransports.delete(sessionId);
    });

    // Create MCP server instance and connect to transport
    // Note: This is intentionally NOT awaited because connect() may block
    // waiting for the initialize message from the client. The client needs
    // the session to be registered first to send messages.
    const mcpServer = mcpServerFactory();
    mcpServer.connect(transport).catch((err) => {
      logger.error('MCP server connection error for session %s: %s', sessionId, err);
      transport.close().catch(() => {});
      sseTransports.delete(sessionId);
    });

    logger.debug('SSE stream connected for session: %s', sessionId);
  } catch (error) {
    logger.error('Error setting up SSE connection: %s', error);
    if (!res.headersSent) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
    }
  }
}
/* v8 ignore stop */

// Backwards compatibility alias
export { handleSseConnection as handleLegacySseConnection };

/**
 * Creates the SSE Router (deprecated HTTP+SSE transport from protocol 2024-11-05)
 *
 * This router is only created when MCP_LEGACY_SSE_ENABLED=true
 *
 * Endpoints:
 * - GET /sse → Opens SSE stream, sends endpoint event with message URL
 * - POST /message?sessionId=xxx → Receives JSON-RPC messages
 *
 * Note: The SSE transport handles the handshake:
 * 1. Client connects to GET /sse
 * 2. Server sends 'endpoint' event with URL for POSTing messages
 * 3. Client POSTs JSON-RPC messages to that URL
 * 4. Server responds via the SSE stream
 */
export function createSseRouter(mcpServerFactory: McpServerFactory): Router {
  const router = Router();

  if (!config.MCP_LEGACY_SSE_ENABLED) {
    // Return router with endpoints that indicate feature is disabled
    const disabledHandler = (_req: Request, res: Response) => {
      res
        .status(HttpStatus.NOT_IMPLEMENTED)
        .json(
          createJsonRpcError(
            JsonRpcErrorCode.SESSION_NOT_FOUND,
            'SSE transport is disabled. Enable with MCP_LEGACY_SSE_ENABLED=true or use Streamable HTTP transport.',
          ),
        );
    };
    router.get('/sse', disabledHandler);
    router.post('/sse/message', disabledHandler);
    router.post('/mcp/message', disabledHandler);
    return router;
  }

  logger.info('SSE transport enabled (deprecated protocol 2024-11-05)');

  /**
   * Shared message handler for SSE POST requests
   *
   * Used by both /sse/message and /mcp/message endpoints
   */
  const handleSseMessage = async (req: Request, res: Response, endpoint: string) => {
    const sessionId = req.query.sessionId as string | undefined;

    if (!sessionId) {
      logger.warn('SSE POST %s rejected: missing sessionId query param', endpoint);
      res
        .status(HttpStatus.BAD_REQUEST)
        .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, 'sessionId query parameter required'));
      return;
    }

    /* v8 ignore start - SSE session handling */
    const transport = sseTransports.get(sessionId);
    if (!transport) {
      logger.warn('SSE POST %s rejected: session not found [%s]', endpoint, sessionId.substring(0, 8));
      res
        .status(HttpStatus.NOT_FOUND)
        .json(createJsonRpcError(JsonRpcErrorCode.SESSION_NOT_FOUND, TransportErrorMessage.SESSION_NOT_FOUND));
      return;
    }

    try {
      const method = req.body?.method || 'unknown';
      logger.debug('SSE POST %s [%s] method=%s', endpoint, sessionId.substring(0, 8), method);
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error('Error handling SSE POST for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
      }
    }
    /* v8 ignore stop */
  };

  /**
   * GET /sse - SSE connection endpoint
   *
   * Opens SSE stream and sends 'endpoint' event with URL for client to POST messages to.
   * This is the deprecated HTTP+SSE transport from MCP 2024-11-05.
   */
  /* v8 ignore start - SSE routes require real SSE transport */
  router.get('/sse', async (req: Request, res: Response) => {
    logger.info('SSE client connecting via /sse from %s', req.ip || 'unknown');
    await handleSseConnection(req, res, mcpServerFactory, '/sse/message');
  });

  /**
   * POST /sse/message - SSE message endpoint
   *
   * Receives JSON-RPC messages from clients connected via SSE at /sse.
   */
  router.post('/sse/message', async (req: Request, res: Response) => {
    await handleSseMessage(req, res, '/sse/message');
  });
  /* v8 ignore stop */

  /**
   * POST /mcp/message - SSE message endpoint (when connected via /mcp)
   *
   * Receives JSON-RPC messages from clients connected via SSE at /mcp.
   * This is mounted BEFORE the Streamable HTTP middleware stack to avoid validation conflicts.
   */
  router.post('/mcp/message', async (req: Request, res: Response) => {
    await handleSseMessage(req, res, '/mcp/message');
  });

  return router;
}

// Backwards compatibility alias
export { createSseRouter as createLegacySseRouter };
