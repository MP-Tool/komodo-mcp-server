/**
 * MCP Transport Routes
 *
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification)
 * with optional backwards compatibility for Legacy SSE Transport.
 *
 * Streamable HTTP Transport (default, recommended):
 * - POST /mcp with InitializeRequest (no session) → Creates session, returns Mcp-Session-Id header
 * - POST /mcp with Mcp-Session-Id header → Reuses existing session for JSON-RPC messages
 * - GET /mcp with Mcp-Session-Id header → SSE stream for server-to-client notifications
 * - DELETE /mcp with Mcp-Session-Id header → Terminates session
 *
 * Legacy SSE Transport (optional, deprecated - enable with MCP_LEGACY_SSE_ENABLED=true):
 * - GET /mcp (no session, Accept: text/event-stream) → Opens SSE stream with endpoint event
 * - POST /mcp/message?sessionId=xxx → Receives JSON-RPC messages from legacy SSE clients
 *
 * Session Management:
 * - Sessions are identified by Mcp-Session-Id header
 * - Sessions expire after inactivity (configurable)
 * - Graceful shutdown closes all active sessions
 *
 * See: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { LegacySseTransport } from '../legacy-sse-transport.js';
import { TransportSessionManager } from '../session-manager.js';
import { createJsonRpcError, JsonRpcErrorCode } from '../utils/index.js';
import { logger as baseLogger } from '../../utils/logger.js';
import { config, LEGACY_SSE_MAX_SESSIONS, HttpStatus, TransportErrorMessage } from '../../config/index.js';

const logger = baseLogger.child({ component: 'transport' });

// Store active Legacy SSE transports by session ID (separate from Streamable HTTP sessions)
const legacySseTransports = new Map<string, LegacySseTransport>();

/**
 * Get the number of active legacy SSE sessions
 */
export function getLegacySseSessionCount(): number {
  return legacySseTransports.size;
}

/**
 * Close all active legacy SSE sessions
 */
export async function closeAllLegacySseSessions(): Promise<void> {
  if (legacySseTransports.size === 0) return;
  logger.info('Closing %d legacy SSE sessions', legacySseTransports.size);
  const closePromises = Array.from(legacySseTransports.values()).map((transport) =>
    transport.close().catch((err) => logger.error('Error closing legacy SSE transport: %s', err)),
  );
  await Promise.all(closePromises);
  legacySseTransports.clear();
}

/**
 * Check if Legacy SSE mode is enabled
 */
export function isLegacySseEnabled(): boolean {
  return config.MCP_LEGACY_SSE_ENABLED;
}

/**
 * Handle a Legacy SSE connection (shared logic for /mcp and /sse endpoints)
 *
 * Creates an SSE stream and connects the MCP server to it.
 * The messageEndpoint parameter determines where clients should POST messages to.
 *
 * Note: mcpServer.connect() automatically calls transport.start() internally,
 * which sends the 'endpoint' SSE event with the message URL containing the sessionId.
 */
async function handleLegacySseConnection(
  req: Request,
  res: Response,
  mcpServerFactory: () => McpServer,
  messageEndpoint: string,
): Promise<void> {
  // Check session limit to prevent memory exhaustion
  if (legacySseTransports.size >= LEGACY_SSE_MAX_SESSIONS) {
    logger.warn('Legacy SSE session limit reached (%d), rejecting connection', LEGACY_SSE_MAX_SESSIONS);
    res
      .status(HttpStatus.SERVICE_UNAVAILABLE)
      .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, TransportErrorMessage.TOO_MANY_SESSIONS));
    return;
  }

  try {
    // Create our custom Legacy SSE transport
    // This replaces the deprecated SSEServerTransport from the SDK
    const transport = new LegacySseTransport(messageEndpoint, res);

    // Start the transport first (sends endpoint event with sessionId)
    await transport.start();

    // Get the sessionId that was sent to the client in the endpoint event
    const sessionId = transport.sessionId;

    // IMPORTANT: Store transport BEFORE connecting MCP server!
    // mcpServer.connect() may wait for the initialize message, but the client
    // needs the session to be registered before it can send messages.
    legacySseTransports.set(sessionId, transport);
    logger.info('Legacy SSE session created: %s', sessionId);

    // Handle cleanup when connection closes
    transport.onclose = () => {
      logger.info('Legacy SSE session closed: %s', sessionId);
      legacySseTransports.delete(sessionId);
    };

    // Also handle request close/error
    req.on('close', () => {
      logger.debug('Legacy SSE request closed: %s', sessionId);
      transport.close().catch((err) => logger.error('Error closing legacy SSE transport: %s', err));
      legacySseTransports.delete(sessionId);
    });

    // Create MCP server instance and connect to transport
    // Note: This is intentionally NOT awaited because connect() may block
    // waiting for the initialize message from the client. The client needs
    // the session to be registered first to send messages.
    const mcpServer = mcpServerFactory();
    mcpServer.connect(transport).catch((err) => {
      logger.error('MCP server connection error for session %s: %s', sessionId, err);
      transport.close().catch(() => {});
      legacySseTransports.delete(sessionId);
    });

    logger.debug('Legacy SSE stream connected for session: %s', sessionId);
  } catch (error) {
    logger.error('Error setting up Legacy SSE connection: %s', error);
    if (!res.headersSent) {
      res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
    }
  }
}

/**
 * Creates the MCP router with StreamableHTTPServerTransport and Legacy SSE fallback
 */
export function createMcpRouter(mcpServerFactory: () => McpServer, sessionManager: TransportSessionManager): Router {
  const router = Router();

  /**
   * POST /mcp - Main endpoint for JSON-RPC messages
   *
   * Flow 1: Initialize (no session) → Create new session
   * Flow 2: With session → Use existing transport
   */
  router.post('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      // Flow 1: New session via InitializeRequest
      if (!sessionId && isInitializeRequest(req.body)) {
        logger.info('Creating new session via POST initialize form %s', req.ip);

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            logger.info('Session initialized: %s', newSessionId);
            sessionManager.add(newSessionId, transport);
          },
          onsessionclosed: (closedSessionId) => {
            logger.info('Session closed: %s', closedSessionId);
            sessionManager.remove(closedSessionId);
          },
        });

        // Set up cleanup handler
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessionManager.remove(sid);
          }
        };

        // Connect MCP server to transport BEFORE handling request
        const mcpServer = mcpServerFactory();
        await mcpServer.connect(transport);

        // Handle the initialize request
        await (transport as StreamableHTTPServerTransport).handleRequest(req, res, req.body);
        return;
      }

      // Flow 2: Existing session
      if (!sessionId) {
        logger.warn('POST /mcp rejected: missing session ID for non-initialize request');
        res
          .status(HttpStatus.BAD_REQUEST)
          .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, TransportErrorMessage.SESSION_ID_REQUIRED));
        return;
      }

      const transport = sessionManager.get(sessionId);
      if (transport) {
        const method = req.body?.method || 'unknown';
        logger.debug('POST /mcp [%s] method=%s', sessionId.substring(0, 8), method);
        await (transport as StreamableHTTPServerTransport).handleRequest(req, res, req.body);
        return;
      }

      // Session not found
      logger.warn('POST /mcp rejected: session not found [%s]', sessionId.substring(0, 8));
      res
        .status(HttpStatus.NOT_FOUND)
        .json(createJsonRpcError(JsonRpcErrorCode.SESSION_NOT_FOUND, TransportErrorMessage.SESSION_NOT_FOUND));
      return;
    } catch (error) {
      logger.error('Error handling POST request: %s', error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
      }
    }
  });

  /**
   * GET /mcp - SSE stream for server-to-client notifications
   *
   * Per MCP Spec 2025-03-26:
   * - Client MAY issue HTTP GET to receive server-initiated messages
   * - Requires Mcp-Session-Id header from prior initialization
   * - Returns Content-Type: text/event-stream
   *
   * For clients that cannot set headers (e.g., browser EventSource),
   * session ID can be passed via query parameter as fallback.
   */
  router.get('/', async (req: Request, res: Response) => {
    // Accept session ID via header OR query parameter (EventSource fallback)
    let sessionId: string | undefined = req.headers['mcp-session-id'] as string | undefined;

    // Fallback: check query parameters for clients that cannot set headers
    if (!sessionId && req.query) {
      sessionId =
        (req.query['mcp-session-id'] as string | undefined) ||
        (req.query['mcp_session_id'] as string | undefined) ||
        (req.query['sessionId'] as string | undefined) ||
        (req.query['session_id'] as string | undefined);
      if (sessionId) {
        logger.debug('GET /mcp session ID received via query param');
      }
    }

    // Session ID is required for GET requests (Streamable HTTP)
    // BUT: If Legacy SSE is enabled and client sends Accept: text/event-stream without session,
    // this is a Legacy SSE connection attempt - handle it as such
    if (!sessionId) {
      const acceptHeader = req.headers['accept'] || '';
      const wantsSSE = acceptHeader.includes('text/event-stream');

      // Legacy SSE Fallback: GET /mcp with Accept: text/event-stream and no session
      if (wantsSSE && config.MCP_LEGACY_SSE_ENABLED) {
        logger.info('Legacy SSE client connecting via /mcp from %s', req.ip || 'unknown');
        await handleLegacySseConnection(req, res, mcpServerFactory, '/mcp/message');
        return;
      }

      // Per MCP spec: "Servers that require a session ID SHOULD respond to requests
      // without an Mcp-Session-Id header with HTTP 400 Bad Request"
      res
        .status(HttpStatus.BAD_REQUEST)
        .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, TransportErrorMessage.SESSION_ID_OR_PARAM_REQUIRED));
      return;
    }

    const transport = sessionManager.get(sessionId);
    if (!transport) {
      // Per MCP spec: "The server MAY terminate the session at any time, after which
      // it MUST respond to requests containing that session ID with HTTP 404 Not Found"
      logger.warn('GET /mcp rejected: session not found [%s]', sessionId.substring(0, 8));
      res
        .status(HttpStatus.NOT_FOUND)
        .json(createJsonRpcError(JsonRpcErrorCode.SESSION_NOT_FOUND, TransportErrorMessage.SESSION_NOT_FOUND_REINIT));
      return;
    }

    logger.debug('GET /mcp SSE stream opened [%s]', sessionId.substring(0, 8));

    try {
      // If session ID came from query param, inject it into rawHeaders for SDK compatibility
      // The SDK uses @hono/node-server which reads from rawHeaders, not headers
      // rawHeaders is an array of [key, value, key, value, ...] pairs
      if (!req.headers['mcp-session-id'] && sessionId) {
        req.rawHeaders.push('mcp-session-id', sessionId);
        // Also set in headers for consistency
        (req.headers as Record<string, string | string[] | undefined>)['mcp-session-id'] = sessionId;
        logger.debug('Injected session ID into rawHeaders for SSE request');
      }

      // Let the SDK handle the SSE stream setup
      await (transport as StreamableHTTPServerTransport).handleRequest(req, res);
    } catch (error) {
      logger.error('Error handling GET request for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
      }
    }
  });

  /**
   * DELETE /mcp - Terminate session
   *
   * Per MCP Spec 2025-03-26:
   * "Clients that no longer need a particular session SHOULD send
   * an HTTP DELETE to the MCP endpoint with the Mcp-Session-Id header"
   */
  router.delete('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId) {
      res
        .status(HttpStatus.BAD_REQUEST)
        .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, TransportErrorMessage.SESSION_ID_REQUIRED));
      return;
    }

    const transport = sessionManager.get(sessionId);
    if (!transport) {
      res
        .status(HttpStatus.NOT_FOUND)
        .json(createJsonRpcError(JsonRpcErrorCode.SESSION_NOT_FOUND, TransportErrorMessage.SESSION_NOT_FOUND));
      return;
    }

    try {
      // Let SDK handle DELETE (it will call onsessionclosed callback)
      await (transport as StreamableHTTPServerTransport).handleRequest(req, res);
    } catch (error) {
      logger.error('Error handling DELETE request for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
      }
    }
  });

  /**
   * Reject unsupported methods
   */
  router.all('/', (req: Request, res: Response) => {
    res.status(HttpStatus.METHOD_NOT_ALLOWED).json(createJsonRpcError(JsonRpcErrorCode.METHOD_NOT_FOUND));
  });

  return router;
}

/**
 * Creates the Legacy SSE Router (deprecated HTTP+SSE transport from protocol 2024-11-05)
 *
 * This router is only created when MCP_LEGACY_SSE_ENABLED=true
 *
 * Endpoints:
 * - GET /sse → Opens SSE stream, sends endpoint event with message URL
 * - POST /message?sessionId=xxx → Receives JSON-RPC messages
 *
 * Note: The SDK's SSEServerTransport handles the handshake:
 * 1. Client connects to GET /sse
 * 2. Server sends 'endpoint' event with URL for POSTing messages
 * 3. Client POSTs JSON-RPC messages to that URL
 * 4. Server responds via the SSE stream
 */
export function createLegacySseRouter(mcpServerFactory: () => McpServer): Router {
  const router = Router();

  if (!config.MCP_LEGACY_SSE_ENABLED) {
    // Return router with endpoints that indicate feature is disabled
    const disabledHandler = (_req: Request, res: Response) => {
      res
        .status(HttpStatus.NOT_IMPLEMENTED)
        .json(
          createJsonRpcError(
            JsonRpcErrorCode.SESSION_NOT_FOUND,
            'Legacy SSE transport is disabled. Enable with MCP_LEGACY_SSE_ENABLED=true or use Streamable HTTP transport.',
          ),
        );
    };
    router.get('/sse', disabledHandler);
    router.post('/sse/message', disabledHandler);
    router.post('/mcp/message', disabledHandler);
    return router;
  }

  logger.info('Legacy SSE transport enabled (deprecated protocol 2024-11-05)');

  /**
   * Shared message handler for Legacy SSE POST requests
   *
   * Used by both /sse/message and /mcp/message endpoints
   */
  const handleLegacySseMessage = async (req: Request, res: Response, endpoint: string) => {
    const sessionId = req.query.sessionId as string | undefined;

    if (!sessionId) {
      logger.warn('Legacy SSE POST %s rejected: missing sessionId query param', endpoint);
      res
        .status(HttpStatus.BAD_REQUEST)
        .json(createJsonRpcError(JsonRpcErrorCode.SERVER_ERROR, 'sessionId query parameter required'));
      return;
    }

    const transport = legacySseTransports.get(sessionId);
    if (!transport) {
      logger.warn('Legacy SSE POST %s rejected: session not found [%s]', endpoint, sessionId.substring(0, 8));
      res
        .status(HttpStatus.NOT_FOUND)
        .json(createJsonRpcError(JsonRpcErrorCode.SESSION_NOT_FOUND, TransportErrorMessage.SESSION_NOT_FOUND));
      return;
    }

    try {
      const method = req.body?.method || 'unknown';
      logger.debug('Legacy SSE POST %s [%s] method=%s', endpoint, sessionId.substring(0, 8), method);
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      logger.error('Error handling Legacy SSE POST for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
      }
    }
  };

  /**
   * GET /sse - Legacy SSE connection endpoint
   *
   * Opens SSE stream and sends 'endpoint' event with URL for client to POST messages to.
   * This is the deprecated HTTP+SSE transport from MCP 2024-11-05.
   */
  router.get('/sse', async (req: Request, res: Response) => {
    logger.info('Legacy SSE client connecting via /sse from %s', req.ip || 'unknown');
    await handleLegacySseConnection(req, res, mcpServerFactory, '/sse/message');
  });

  /**
   * POST /sse/message - Legacy SSE message endpoint
   *
   * Receives JSON-RPC messages from clients connected via Legacy SSE at /sse.
   */
  router.post('/sse/message', async (req: Request, res: Response) => {
    await handleLegacySseMessage(req, res, '/sse/message');
  });

  /**
   * POST /mcp/message - Legacy SSE message endpoint (when connected via /mcp)
   *
   * Receives JSON-RPC messages from clients connected via Legacy SSE at /mcp.
   * This is mounted BEFORE the Streamable HTTP middleware stack to avoid validation conflicts.
   */
  router.post('/mcp/message', async (req: Request, res: Response) => {
    await handleLegacySseMessage(req, res, '/mcp/message');
  });

  return router;
}
