/**
 * Test Utilities for MCP Transport Layer
 * Shared constants and helper functions for testing the transport layer.
 */

import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createExpressApp } from '../../src/transport/http-server.js';
import { TransportSessionManager } from '../../src/transport/session-manager.js';

// Get package version dynamically
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
export const PACKAGE_VERSION = packageJson.version;

/**
 * Protocol Version Constants
 * These match the versions defined in src/transport/config/transport.config.ts
 */
export const PROTOCOL_VERSION_2025_11_25 = '2025-11-25';
export const PROTOCOL_VERSION_2025_06_18 = '2025-06-18';
export const LATEST_PROTOCOL_VERSION = PROTOCOL_VERSION_2025_11_25;
export const LEGACY_PROTOCOL_VERSION = '2024-11-05';

/**
 * Default Test Configuration
 * Mocks the environment variables used by the server.
 */
export const TEST_CONFIG = {
  MCP_PORT: 3000,
  MCP_BIND_HOST: '127.0.0.1',
  VERSION: PACKAGE_VERSION,
  MCP_TRANSPORT: 'sse'
};

/**
 * Helper to setup the Express app with a mock MCP server.
 * Creates a fresh instance for each test to ensure isolation.
 * @returns {{ app: express.Application, sessionManager: TransportSessionManager }} The configured Express application and session manager
 */
export const setupTestApp = () => {
    return createExpressApp(() => new McpServer({
      name: 'test-server',
      version: PACKAGE_VERSION
    }));
};

/**
 * Helper to cleanup the test app.
 * Closes all active sessions to prevent leaks and open handles.
 * @param {TransportSessionManager} sessionManager - The session manager to cleanup
 */
export const cleanupTestApp = async (sessionManager: TransportSessionManager) => {
    if (sessionManager) {
        await sessionManager.closeAll();
    }
};/**
 * Helper to create a standard SSE request.
 * Sets the necessary headers for a valid MCP SSE connection.
 * @param {express.Application} app - The Express application
 * @param {string} version - The MCP protocol version to use (defaults to latest)
 * @returns {request.Test} The supertest request object
 */
export const createSseRequest = (app: express.Application, version: string = LATEST_PROTOCOL_VERSION) => {
  return request(app)
    .get('/mcp')
    .set('Host', 'localhost:3000')
    .set('MCP-Protocol-Version', version)
    .set('Accept', 'text/event-stream')
    .buffer(false);
};

