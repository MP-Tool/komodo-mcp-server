/**
 * MCP Transport Layer - Newest Client Compatibility Tests (2025-11-25)
 *
 * These tests verify that the server correctly handles clients using the latest 2025-11-25 protocol version.
 * Uses the modern Streamable HTTP transport (POST initialize → session via header).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { TransportSessionManager } from '../../src/transport/session-manager.js';
import {
  setupTestApp,
  cleanupTestApp,
  initializeAndParse,
  createPostRequest,
  PROTOCOL_VERSION_2025_11_25,
} from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

describe('MCP Transport Layer - Newest Client Compatibility (2025-11-25)', () => {
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
   * Test: Modern Streamable HTTP Connection Flow
   *
   * Modern Flow (MCP 2025-03-26):
   * 1. POST /mcp with InitializeRequest (no session) → Creates session, returns Mcp-Session-Id header
   * 2. Subsequent POST /mcp with Mcp-Session-Id header → Uses existing session
   */
  it(`should support modern Streamable HTTP flow (${PROTOCOL_VERSION_2025_11_25})`, async () => {
    // 1. Initialize request (no session) - SDK returns SSE response
    const { result, sessionId, response } = await initializeAndParse(app, PROTOCOL_VERSION_2025_11_25);

    // Expect successful initialization
    expect(response.status).toBe(200);
    expect(result.jsonrpc).toBe('2.0');
    expect(result.result).toBeDefined();
    expect(result.result?.protocolVersion).toBeDefined();
    expect(result.result?.serverInfo).toBeDefined();
    expect(result.result?.capabilities).toBeDefined();

    // Session ID should be in response header
    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBeGreaterThan(0);

    // 2. Send initialized notification with session
    const notificationResponse = await createPostRequest(
      app,
      sessionId,
      { jsonrpc: '2.0', method: 'notifications/initialized' },
      PROTOCOL_VERSION_2025_11_25,
    );

    // Notifications should return 202 Accepted
    expect(notificationResponse.status).toBe(202);
  });

  /**
   * Test: Verify negotiated protocol version
   * Server should echo back the supported protocol version.
   */
  it(`should negotiate protocol version ${PROTOCOL_VERSION_2025_11_25}`, async () => {
    const { result } = await initializeAndParse(app, PROTOCOL_VERSION_2025_11_25);

    expect(result.result?.protocolVersion).toBe(PROTOCOL_VERSION_2025_11_25);
  });
});
