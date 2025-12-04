/**
 * MCP Transport Routes
 * Handles SSE connection and JSON-RPC message exchange
 */

import { Router, Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TransportSessionManager } from '../session-manager.js';
import { createSecureTransport } from '../transport-factory.js';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { logSessionInitialized, logSessionClosed } from '../utils/logging.js';

/**
 * Creates the MCP router with injected dependencies
 */
export function createMcpRouter(mcpServerFactory: () => McpServer, sessionManager: TransportSessionManager): Router {
    const router = Router();

    /**
     * GET /mcp
     * Initializes a new SSE connection for MCP
     */
    router.get('/', async (req: Request, res: Response) => {
        try {
            const transport = createSecureTransport({
                onSessionInitialized: (sessionId) => {
                    logSessionInitialized(sessionId);
                    sessionManager.add(sessionId, transport);
                },
                onSessionClosed: (sessionId) => {
                    logSessionClosed(sessionId);
                    sessionManager.remove(sessionId);
                }
            });

            // Create a new MCP server instance for this connection
            const mcpServer = mcpServerFactory();

            // Connect the transport to the MCP server
            await mcpServer.connect(transport);

            // Handle the request with the transport
            // The transport will handle headers and keeping the connection open
            await transport.handleRequest(req, res);
            
        } catch (error) {
            console.error('[MCP] Error initializing SSE connection:', error);
            if (!res.headersSent) {
                res.status(500).json(createJsonRpcError(-32603, 'Internal Error initializing transport'));
            }
        }
    });

    /**
     * POST /mcp
     * Handles JSON-RPC messages from the client
     * Requires ?sessionId=... query parameter
     */
    router.post('/', async (req: Request, res: Response) => {
        const sessionId = req.query.sessionId as string;
        
        if (!sessionId) {
            res.status(400).json(createJsonRpcError(-32602, 'Missing sessionId query parameter'));
            return;
        }

        const transport = sessionManager.get(sessionId);

        if (!transport) {
            res.status(404).json(createJsonRpcError(-32001, 'Session not found or expired'));
            return;
        }

        try {
            await transport.handleRequest(req, res, req.body);
        } catch (error) {
            console.error('[MCP] Error handling POST message:', error);
            if (!res.headersSent) {
                res.status(500).json(createJsonRpcError(-32603, 'Internal Error handling message'));
            }
        }
    });

    /**
     * Handle unsupported methods
     */
    router.all('/', (req: Request, res: Response) => {
        res.status(405).json(createJsonRpcError(-32601, 'Method Not Allowed'));
    });

    return router;
}
