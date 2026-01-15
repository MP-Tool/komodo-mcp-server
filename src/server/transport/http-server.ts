/**
 * HTTP Server for MCP Transport
 *
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification)
 * with optional backwards compatibility for Legacy SSE Transport.
 *
 * Streamable HTTP Transport (default, recommended):
 * - POST /mcp with InitializeRequest → Creates session
 * - POST /mcp with Mcp-Session-Id header → Reuses session
 * - DELETE /mcp with Mcp-Session-Id header → Terminates session
 *
 * Legacy SSE Transport (optional, deprecated - enable with MCP_LEGACY_SSE_ENABLED=true):
 * - GET /mcp with Mcp-Session-Id header → SSE notifications
 * - GET /sse → Opens SSE stream with endpoint event
 * - POST /sse/message?sessionId=xxx → Receives JSON-RPC messages from legacy SSE clients
 *
 * Architecture:
 * - Express.js application
 * - Modular middleware stack
 * - Session management with automatic expiration
 *
 * Security features (MCP Specification 2025-03-26):
 * - DNS Rebinding Protection (MUST)
 * - Rate Limiting
 * - Protocol Version Validation
 * - Accept Header Validation (MUST)
 * - Session Expiration
 *
 * See: https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

import express from 'express';
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { parseFrameworkEnv } from '../config/index.js';
import { logger as baseLogger } from '../logger/index.js';

// Session Management
import { TransportSessionManager } from '../session/index.js';

// Middleware
import {
  mcpRateLimiter,
  validateProtocolVersion,
  validateAcceptHeader,
  dnsRebindingProtection,
  validateContentType,
  validateJsonRpc,
} from './middleware/index.js';

// Routes
import { createHealthRouter } from './routes/index.js';
import { createStreamableHttpRouter } from './streamable-http/index.js';
import { createSseRouter, closeAllSseSessions, isSseEnabled } from './sse/index.js';
import { TRANSPORT_LOG_COMPONENTS } from './core/index.js';

const logger = baseLogger.child({ component: TRANSPORT_LOG_COMPONENTS.HTTP_SERVER });

import { Server } from 'node:http';

/**
 * Creates and configures the Express application
 */
export function createExpressApp(mcpServerFactory: () => McpServer): {
  app: express.Application;
  sessionManager: TransportSessionManager;
} {
  const app = express();
  const sessionManager = new TransportSessionManager();

  // ===== Global Middleware =====
  app.use(
    helmet({
      strictTransportSecurity: false, // Disable HSTS for now
    }),
  );
  app.use(express.json());

  // ===== Routes =====

  // Health check endpoint (no rate limiting or security middleware)
  app.use(createHealthRouter(sessionManager));

  // ===== Legacy SSE Transport Routes (optional) =====
  // IMPORTANT: Mount Legacy SSE message endpoints BEFORE the MCP middleware stack
  // This ensures Legacy SSE messages don't go through Streamable HTTP validation
  // Deprecated HTTP+SSE transport from protocol 2024-11-05
  // Enable with MCP_LEGACY_SSE_ENABLED=true
  if (isSseEnabled()) {
    logger.info('Mounting SSE endpoints at /mcp/message, /sse and /sse/message');
  }
  // Always mount the router - it returns 501 if feature is disabled
  app.use(createSseRouter(mcpServerFactory));

  // ===== MCP Transport Routes =====
  // Streamable HTTP transport on /mcp endpoint
  app.use('/mcp', dnsRebindingProtection); // 1. DNS Rebinding Protection (MUST)
  app.use('/mcp', mcpRateLimiter); // 2. Rate Limiting
  app.use('/mcp', validateProtocolVersion); // 3. Protocol Version (MUST)
  app.use('/mcp', validateAcceptHeader); // 4. Accept Header (MUST)
  app.use('/mcp', validateContentType); // 5. Content-Type (MUST for POST)
  app.use('/mcp', validateJsonRpc); // 6. JSON-RPC Validation (MUST for POST)

  // MCP route handler
  app.use('/mcp', createStreamableHttpRouter(mcpServerFactory, sessionManager));

  return { app, sessionManager };
}

/**
 * HTTP Server Configuration Options
 */
export interface HttpServerOptions {
  /** Port to listen on (default: from MCP_PORT env or 3000) */
  port?: number;
  /** Host to bind to (default: from MCP_BIND_HOST env or '127.0.0.1') */
  bindHost?: string;
}

/**
 * Starts the HTTP server
 *
 * @param mcpServerFactory - Factory function to create MCP server instances
 * @param options - Optional server configuration (defaults to environment variables)
 */
export function startHttpServer(
  mcpServerFactory: () => McpServer,
  options: HttpServerOptions = {},
): {
  server: Server;
  sessionManager: TransportSessionManager;
} {
  const { app, sessionManager } = createExpressApp(mcpServerFactory);

  // ===== Server Startup =====
  // Use provided options or fall back to framework environment config
  const frameworkConfig = parseFrameworkEnv();
  const port = options.port ?? frameworkConfig.MCP_PORT;
  const bindHost = options.bindHost ?? frameworkConfig.MCP_BIND_HOST;

  const server = app.listen(port, bindHost, () => {
    logger.info('Server listening on %s:%d', bindHost, port);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down HTTP server...');
    await sessionManager.closeAll();
    // Also close SSE sessions if enabled
    if (isSseEnabled()) {
      await closeAllSseSessions();
    }
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, sessionManager };
}
