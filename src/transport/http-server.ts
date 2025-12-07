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
import helmet from 'helmet';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { config } from '../config/env.js';

// Session Management
import { TransportSessionManager } from './session-manager.js';

// Middleware
import { mcpRateLimiter } from './middleware/rate-limit.js';
import { validateProtocolVersion } from './middleware/protocol-version.js';
import { validateAcceptHeader } from './middleware/accept-header.js';
import { dnsRebindingProtection } from './middleware/dns-rebinding.js';
import { validateContentType } from './middleware/content-type.js';
import { validateJsonRpc } from './middleware/json-rpc.js';

// Routes
import { createHealthRouter } from './routes/health.js';
import { createMcpRouter } from './routes/mcp.js';

// Utilities
import { logger as baseLogger } from '../utils/logger.js';

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
  app.disable('x-powered-by'); // Disable X-Powered-By header for security
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

  // MCP endpoint with security middleware stack
  app.use('/mcp', dnsRebindingProtection); // 1. DNS Rebinding Protection (MUST) - Check first!
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
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { server, sessionManager };
}
