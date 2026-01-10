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

/** JSON-RPC message type for SSE parsing (internal use) */
interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: InitializeResult;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/** Initialize result structure from MCP protocol (internal use) */
interface InitializeResult {
  protocolVersion: string;
  serverInfo: {
    name: string;
    version: string;
  };
  capabilities: Record<string, unknown>;
}

// Get package version dynamically
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
export const PACKAGE_VERSION = packageJson.version;

/**
 * Protocol Version Constants
 * These match the versions defined in src/config/transport.config.ts
 */
export const PROTOCOL_VERSION_2025_11_25 = '2025-11-25';
export const PROTOCOL_VERSION_2025_06_18 = '2025-06-18';
export const LEGACY_PROTOCOL_VERSION = '2024-11-05';

/** Alias for the newest protocol version - use in tests for readability */
export const LATEST_PROTOCOL_VERSION = PROTOCOL_VERSION_2025_11_25;

/**
 * Helper to setup the Express app with a mock MCP server.
 * Creates a fresh instance for each test to ensure isolation.
 * @returns The configured Express application and session manager
 */
export const setupTestApp = () => {
  return createExpressApp(
    () =>
      new McpServer({
        name: 'test-server',
        version: PACKAGE_VERSION,
      }),
  );
};

/**
 * Helper to cleanup the test app.
 * Closes all active sessions to prevent leaks and open handles.
 * @param sessionManager - The session manager to cleanup
 */
export const cleanupTestApp = async (sessionManager: TransportSessionManager) => {
  if (sessionManager) {
    await sessionManager.closeAll();
  }
};

/**
 * Helper to create an initialize request for the modern Streamable HTTP flow.
 *
 * Modern Flow (MCP 2025-03-26):
 * 1. POST /mcp with InitializeRequest (no session) → Creates session, returns Mcp-Session-Id header
 * 2. Subsequent POST /mcp with Mcp-Session-Id header → Uses existing session
 *
 * @param app - The Express application
 * @param version - The MCP protocol version to use (defaults to latest)
 * @returns The supertest request object configured for initialize
 */
export const createInitializeRequest = (app: express.Application, version: string = LATEST_PROTOCOL_VERSION) => {
  return request(app)
    .post('/mcp')
    .set('Host', 'localhost:3000')
    .set('MCP-Protocol-Version', version)
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json')
    .send({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: version,
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0' },
      },
      id: 1,
    });
};

/**
 * Helper to create a POST request with an existing session.
 *
 * @param app - The Express application
 * @param sessionId - The session ID from initialization
 * @param body - The JSON-RPC request body
 * @param version - The MCP protocol version (defaults to latest)
 * @returns The supertest request object
 */
export const createPostRequest = (
  app: express.Application,
  sessionId: string,
  body: object,
  version: string = LATEST_PROTOCOL_VERSION,
) => {
  return request(app)
    .post('/mcp')
    .set('Host', 'localhost:3000')
    .set('Mcp-Session-Id', sessionId)
    .set('MCP-Protocol-Version', version)
    .set('Accept', 'application/json, text/event-stream')
    .set('Content-Type', 'application/json')
    .send(body);
};

/**
 * Initialize a session and return the session ID.
 * Helper for tests that need a session but don't test initialization itself.
 *
 * @param app - The Express application
 * @param version - The MCP protocol version (defaults to latest)
 * @returns Promise resolving to the session ID
 */
export const initializeSession = async (
  app: express.Application,
  version: string = LATEST_PROTOCOL_VERSION,
): Promise<string> => {
  const response = await createInitializeRequest(app, version);

  if (response.status !== 200) {
    throw new Error(`Initialize failed with status ${response.status}: ${JSON.stringify(response.body)}`);
  }

  const sessionId = response.headers['mcp-session-id'];
  if (!sessionId) {
    throw new Error('No Mcp-Session-Id header in initialize response');
  }

  return sessionId;
};

/**
 * Parse SSE response text to extract JSON-RPC messages.
 * The SDK returns responses as SSE events: "event: message\ndata: {...}\n\n"
 *
 * @param text - The raw SSE text response
 * @returns Array of parsed JSON-RPC messages
 */
export const parseSseResponse = (text: string): JsonRpcMessage[] => {
  const messages: JsonRpcMessage[] = [];

  // SSE format: "event: message\ndata: {...}\n\n"
  const eventPattern = /event:\s*message\s*\ndata:\s*(.+?)(?=\n\n|\nevent:|\n$|$)/gs;
  let match;

  while ((match = eventPattern.exec(text)) !== null) {
    try {
      const jsonData = match[1].trim();
      if (jsonData) {
        messages.push(JSON.parse(jsonData));
      }
    } catch {
      // Ignore parse errors for malformed events
    }
  }

  return messages;
};

/**
 * Create and execute an initialize request, parsing the SSE response.
 * Returns the parsed JSON-RPC result and session ID.
 *
 * @param app - The Express application
 * @param version - The MCP protocol version (defaults to latest)
 * @returns Object with parsed response, session ID, and raw response
 */
export const initializeAndParse = async (
  app: express.Application,
  version: string = LATEST_PROTOCOL_VERSION,
): Promise<{
  result: JsonRpcMessage;
  sessionId: string;
  response: request.Response;
}> => {
  const response = await createInitializeRequest(app, version);

  if (response.status !== 200) {
    throw new Error(`Initialize failed with status ${response.status}: ${response.text}`);
  }

  const sessionId = response.headers['mcp-session-id'];
  if (!sessionId) {
    throw new Error('No Mcp-Session-Id header in initialize response');
  }

  // Parse the SSE response to get JSON-RPC result
  const contentType = response.headers['content-type'];
  let result: JsonRpcMessage;

  if (contentType?.includes('text/event-stream')) {
    const messages = parseSseResponse(response.text);
    if (messages.length === 0) {
      throw new Error('No messages in SSE response');
    }
    result = messages[0]; // First message should be the initialize result
  } else if (contentType?.includes('application/json')) {
    result = response.body;
  } else {
    throw new Error(`Unexpected content type: ${contentType}`);
  }

  return { result, sessionId, response };
};
