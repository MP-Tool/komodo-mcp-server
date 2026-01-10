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
import { config } from '../../config/index.js';
import { logger as baseLogger } from '../../utils/index.js';

// Session Management
import { TransportSessionManager } from './session-manager.js';

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
import {
  createHealthRouter,
  createMcpRouter,
  createLegacySseRouter,
  closeAllLegacySseSessions,
  isLegacySseEnabled,
} from './routes/index.js';

const logger = baseLogger.child({ component: 'transport' });

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
  if (isLegacySseEnabled()) {
    logger.info('Mounting Legacy SSE endpoints at /mcp/message, /sse and /sse/message');
  }
  // Always mount the router - it returns 501 if feature is disabled
  app.use(createLegacySseRouter(mcpServerFactory));

  // ===== MCP Transport Routes =====
  // Streamable HTTP transport on /mcp endpoint
  app.use('/mcp', dnsRebindingProtection); // 1. DNS Rebinding Protection (MUST)
  app.use('/mcp', mcpRateLimiter); // 2. Rate Limiting
  app.use('/mcp', validateProtocolVersion); // 3. Protocol Version (MUST)
  app.use('/mcp', validateAcceptHeader); // 4. Accept Header (MUST)
  app.use('/mcp', validateContentType); // 5. Content-Type (MUST for POST)
  app.use('/mcp', validateJsonRpc); // 6. JSON-RPC Validation (MUST for POST)

  // MCP route handler
  app.use('/mcp', createMcpRouter(mcpServerFactory, sessionManager));

  return { app, sessionManager };
}

/**
 * Starts the HTTP server
 */
export function startHttpServer(mcpServerFactory: () => McpServer): {
  server: Server;
  sessionManager: TransportSessionManager;
} {
  const { app, sessionManager } = createExpressApp(mcpServerFactory);

  // ===== Server Startup =====

  const port = config.MCP_PORT;
  const bindHost = config.MCP_BIND_HOST;

  const server = app.listen(port, bindHost, () => {
    logger.info('Server listening on %s:%d', bindHost, port);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down HTTP server...');
    await sessionManager.closeAll();
    // Also close legacy SSE sessions if enabled
    if (isLegacySseEnabled()) {
      await closeAllLegacySseSessions();
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
