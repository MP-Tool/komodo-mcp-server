/**
 * MCP Transport Layer - Legacy Client Compatibility Tests
 *
 * These tests verify that the server correctly handles legacy clients that:
 * 1. Do not send the `MCP-Protocol-Version` header
 * 2. Send the legacy 2024-11-05 protocol version
 *
 * The server should still accept POST initialize requests from these clients,
 * even without version headers (graceful degradation).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TransportSessionManager } from '../../src/transport/session-manager.js';
import { setupTestApp, cleanupTestApp, createPostRequest, parseSseResponse, LEGACY_PROTOCOL_VERSION } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

describe('MCP Transport Layer - Legacy Client Compatibility', () => {
  let app: express.Application;
  let sessionManager: TransportSessionManager;

  beforeEach(() => {
    const setup = setupTestApp();
    app = setup.app;
    sessionManager = setup.sessionManager;
  });

  afterEach(async () => {
    await cleanupTestApp(sessionManager);
  });

  /**
   * Test: Legacy client with no version header
   *
   * Scenario: Client connects without MCP-Protocol-Version header.
   * Expected: Server should still accept initialize request and create session.
   *
   * Note: The modern Streamable HTTP transport doesn't require version headers
   * for basic functionality - it uses the protocolVersion in the initialize params.
   */
  it('should accept initialize request without MCP-Protocol-Version header', async () => {
    // POST initialize without version header
    const initResponse = await request(app)
      .post('/mcp')
      .set('Host', 'localhost:3000')
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      // No MCP-Protocol-Version header
      .send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: LEGACY_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'legacy-test-client', version: '1.0' },
        },
        id: 1,
      });

    // Should succeed
    expect(initResponse.status).toBe(200);

    // Parse SSE response
    const messages = parseSseResponse(initResponse.text);
    expect(messages.length).toBeGreaterThan(0);

    const result = messages[0];
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result).toBeDefined();

    // Session ID should be in response header
    const sessionId = initResponse.headers['mcp-session-id'];
    expect(sessionId).toBeDefined();

    // Should be able to use the session
    const notificationResponse = await createPostRequest(
      app,
      sessionId,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      LEGACY_PROTOCOL_VERSION,
    );

    expect(notificationResponse.status).toBe(202);
  });

  /**
   * Test: Explicit Legacy Version
   *
   * Scenario: Client sends explicit legacy version (2024-11-05) header.
   * Expected: Server accepts initialization and creates session.
   */
  it(`should support explicit legacy version (${LEGACY_PROTOCOL_VERSION})`, async () => {
    const initResponse = await request(app)
      .post('/mcp')
      .set('Host', 'localhost:3000')
      .set('MCP-Protocol-Version', LEGACY_PROTOCOL_VERSION)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: LEGACY_PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: { name: 'legacy-test-client', version: '1.0' },
        },
        id: 1,
      });

    // Should succeed
    expect(initResponse.status).toBe(200);

    // Parse SSE response
    const messages = parseSseResponse(initResponse.text);
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].result).toBeDefined();

    expect(initResponse.headers['mcp-session-id']).toBeDefined();
  });
});
