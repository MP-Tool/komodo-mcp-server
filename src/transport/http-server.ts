/**
 * HTTP Server for MCP Streamable HTTP Transport
 * 
 * Architecture:
 * - Express.js application
 * - Modular middleware stack
 * - Session management
 * - Separate route handlers
 * 
 * Security features (MCP Specification 2025-06-18):
 * - DNS Rebinding Protection
 * - Rate Limiting
 * - Protocol Version Validation
 * - Accept Header Validation
 * - Session Expiration
 */

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from '../config/env.js';

// Session Management
import { TransportSessionManager } from './session-manager.js';

// Middleware
import { mcpRateLimiter } from './middleware/rate-limit.js';
import { validateProtocolVersion } from './middleware/protocol-version.js';
import { validateAcceptHeader } from './middleware/accept-header.js';
import { dnsRebindingProtection } from './middleware/dns-rebinding.js';

// Routes
import { createHealthRouter } from './routes/health.js';
import { createMcpRouter } from './routes/mcp.js';

// Utilities
import { logSecurityStatus } from './utils/logging.js';

/**
 * Creates and configures the Express application
 */
export function createExpressApp(mcpServer: McpServer): express.Application {
    const app = express();
    const sessionManager = new TransportSessionManager();
    
    // ===== Global Middleware =====
    app.use(express.json());

    // ===== Routes =====
    
    // Health check endpoint (no rate limiting or security middleware)
    app.use(createHealthRouter(sessionManager));

    // MCP endpoint with security middleware stack
    app.use('/mcp', dnsRebindingProtection);      // 1. DNS Rebinding Protection (MUST) - Check first!
    app.use('/mcp', mcpRateLimiter);              // 2. Rate Limiting
    app.use('/mcp', validateProtocolVersion);     // 3. Protocol Version (MUST)
    app.use('/mcp', validateAcceptHeader);        // 4. Accept Header (MUST)
    
    // MCP route handler
    app.use('/mcp', createMcpRouter(mcpServer, sessionManager));

    // Expose session manager for shutdown (attached to app for access)
    (app as any).sessionManager = sessionManager;

    return app;
}

/**
 * Starts the HTTP server
 */
export async function startHttpServer(mcpServer: McpServer) {
    const app = createExpressApp(mcpServer);
    const sessionManager = (app as any).sessionManager as TransportSessionManager;

    // ===== Server Startup =====
    
    const port = config.MCP_PORT;
    const bindHost = config.MCP_BIND_HOST;
    
    const server = app.listen(port, bindHost, () => {
        logSecurityStatus(bindHost, port);
    });

    // ===== Graceful Shutdown =====
    
    const shutdown = async () => {
        console.error('[HTTP] Shutting down server...');
        await sessionManager.closeAll();
        
        server.close(() => {
            console.error('[HTTP] Server closed');
            process.exit(0);
        });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
    return server;
}
