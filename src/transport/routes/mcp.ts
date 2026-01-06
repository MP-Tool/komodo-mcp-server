/**
 * MCP Transport Routes
 *
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification)
 * Using StreamableHTTPServerTransport from the official MCP SDK.
 *
 * Endpoints:
 * - POST /mcp with InitializeRequest (no session) → Creates session, returns Mcp-Session-Id header
 * - POST /mcp with Mcp-Session-Id header → Reuses existing session for JSON-RPC messages
 * - GET /mcp with Mcp-Session-Id header → SSE stream for server-to-client notifications
 * - DELETE /mcp with Mcp-Session-Id header → Terminates session
 *
 * Session Management:
 * - Sessions are identified by Mcp-Session-Id header
 * - Sessions expire after inactivity (configurable)
 * - Graceful shutdown closes all active sessions
 */

import { Router, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { TransportSessionManager } from '../session-manager.js';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { logger as baseLogger } from '../../utils/logger.js';

const logger = baseLogger.child({ component: 'transport' });

/**
 * Creates the MCP router with StreamableHTTPServerTransport
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
        logger.info('Creating new session via POST initialize');

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
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Flow 2: Existing session
      if (!sessionId) {
        logger.warn('POST /mcp rejected: missing session ID for non-initialize request');
        res.status(400).json(createJsonRpcError(-32000, 'Bad Request: Mcp-Session-Id header required'));
        return;
      }

      const transport = sessionManager.get(sessionId);
      if (transport) {
        const method = req.body?.method || 'unknown';
        logger.debug('POST /mcp [%s] method=%s', sessionId.substring(0, 8), method);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // Session not found
      logger.warn('POST /mcp rejected: session not found [%s]', sessionId.substring(0, 8));
      res.status(404).json(createJsonRpcError(-32001, 'Session not found or expired'));
      return;
    } catch (error) {
      logger.error('Error handling POST request: %s', error);
      if (!res.headersSent) {
        res.status(500).json(createJsonRpcError(-32603, 'Internal server error'));
      }
    }
  });

  /**
   * GET /mcp - SSE stream for server-to-client notifications
   *
   * Per spec: Clients MAY open an HTTP GET to receive server-initiated messages
   * Requires Mcp-Session-Id header from prior initialization
   */
  router.get('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId) {
      res.status(400).json(createJsonRpcError(-32000, 'Bad Request: Mcp-Session-Id header required'));
      return;
    }

    const transport = sessionManager.get(sessionId);
    if (!transport) {
      logger.warn('GET /mcp rejected: session not found [%s]', sessionId.substring(0, 8));
      res.status(404).json(createJsonRpcError(-32001, 'Session not found or expired. Please re-initialize.'));
      return;
    }

    logger.debug('GET /mcp SSE stream opened [%s]', sessionId.substring(0, 8));

    try {
      // Let the SDK handle the SSE stream setup
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error('Error handling GET request for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res.status(500).json(createJsonRpcError(-32603, 'Internal server error'));
      }
    }
  });

  /**
   * DELETE /mcp - Terminate session
   *
   * Per spec: "Clients that no longer need a particular session SHOULD send
   * an HTTP DELETE to the MCP endpoint with the Mcp-Session-Id header"
   */
  router.delete('/', async (req: Request, res: Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (!sessionId) {
      res.status(400).json(createJsonRpcError(-32000, 'Bad Request: Mcp-Session-Id header required'));
      return;
    }

    const transport = sessionManager.get(sessionId);
    if (!transport) {
      res.status(404).json(createJsonRpcError(-32001, 'Session not found'));
      return;
    }

    try {
      // Let SDK handle DELETE (it will call onsessionclosed callback)
      await transport.handleRequest(req, res);
    } catch (error) {
      logger.error('Error handling DELETE request for session %s: %s', sessionId, error);
      if (!res.headersSent) {
        res.status(500).json(createJsonRpcError(-32603, 'Internal server error'));
      }
    }
  });

  /**
   * Reject unsupported methods
   */
  router.all('/', (req: Request, res: Response) => {
    res.status(405).json(createJsonRpcError(-32601, 'Method Not Allowed'));
  });

  return router;
}
