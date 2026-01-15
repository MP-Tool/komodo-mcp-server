/**
 * Streamable HTTP Transport Routes
 *
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification)
 *
 * Endpoints:
 * - POST /mcp with InitializeRequest (no session) → Creates session, returns Mcp-Session-Id header
 * - POST /mcp with Mcp-Session-Id header → Reuses existing session for JSON-RPC messages
 * - GET /mcp with Mcp-Session-Id header → SSE stream for server-to-client notifications
 * - DELETE /mcp with Mcp-Session-Id header → Terminates session
 *
 * See: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 *
 * @module server/transport/streamable-http/routes
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { TransportSessionManager } from '../../session/index.js';
import { createJsonRpcError, JsonRpcErrorCode } from '../utils/index.js';
import { logger as baseLogger } from '../../logger/index.js';
import { HttpStatus, TransportErrorMessage } from '../../errors/index.js';
import type { McpServerFactory } from './types.js';
import { handleLegacySseConnection, isLegacySseEnabled } from '../sse/index.js';
import { TRANSPORT_LOG_COMPONENTS } from '../core/index.js';

const logger = baseLogger.child({ component: TRANSPORT_LOG_COMPONENTS.STREAMABLE_HTTP });

/**
 * Creates the MCP router with StreamableHTTPServerTransport
 *
 * @param mcpServerFactory - Factory function to create MCP server instances
 * @param sessionManager - Session manager for tracking active sessions
 * @returns Express Router
 */
export function createStreamableHttpRouter(
  mcpServerFactory: McpServerFactory,
  sessionManager: TransportSessionManager,
): Router {
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
        logger.info('Creating new session via POST initialize from %s', req.ip);

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId) => {
            logger.info('Session initialized: %s', newSessionId);
            sessionManager.add(newSessionId, transport);
          },
          /* v8 ignore start - SDK callback only triggered by real MCP protocol */
          onsessionclosed: (closedSessionId) => {
            logger.info('Session closed: %s', closedSessionId);
            sessionManager.remove(closedSessionId);
          },
          /* v8 ignore stop */
        });

        /* v8 ignore start - SDK callback registration, tested via integration */
        // Set up cleanup handler
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            sessionManager.remove(sid);
          }
        };
        /* v8 ignore stop */

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
      /* v8 ignore start - transport handling with SDK */
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
      /* v8 ignore stop */
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
    /* v8 ignore start - Legacy SSE and accept header handling */
    if (!sessionId) {
      const acceptHeader = req.headers['accept'] || '';
      const wantsSSE = acceptHeader.includes('text/event-stream');

      // Legacy SSE Fallback: GET /mcp with Accept: text/event-stream and no session
      if (wantsSSE && isLegacySseEnabled()) {
        logger.info('Legacy SSE client connecting via /mcp from %s', req.ip || 'unknown');
        await handleLegacySseConnection(req, res, mcpServerFactory, '/mcp/message');
        return;
      }
      /* v8 ignore stop */

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
      /* v8 ignore start - defensive error handling */
    } catch (error) {
      logger.error('Error handling GET request for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res
          .status(HttpStatus.INTERNAL_SERVER_ERROR)
          .json(createJsonRpcError(JsonRpcErrorCode.INTERNAL_ERROR, TransportErrorMessage.INTERNAL_ERROR));
      }
    }
    /* v8 ignore stop */
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

    /* v8 ignore start - SDK error handling */
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
    /* v8 ignore stop */
  });

  /**
   * Reject unsupported methods
   */
  router.all('/', (req: Request, res: Response) => {
    res.status(HttpStatus.METHOD_NOT_ALLOWED).json(createJsonRpcError(JsonRpcErrorCode.METHOD_NOT_FOUND));
  });

  return router;
}
