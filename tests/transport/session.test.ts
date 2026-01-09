/**
 * MCP Transport Layer - Session Management Tests
 *
 * These tests verify the session lifecycle management, including:
 * - Session ID validation
 * - Session timeout handling
 * - Cleanup of expired sessions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createExpressApp } from '../../src/transport/http-server.js';
import { TransportSessionManager } from '../../src/transport/session-manager.js';
import { setupTestApp, cleanupTestApp, LATEST_PROTOCOL_VERSION, PACKAGE_VERSION } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

// Suppress ECONNRESET
process.on('uncaughtException', (err: any) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message === 'aborted') {
    return;
  }
  console.error('Uncaught Exception in Test:', err);
});

describe('MCP Transport Layer - Session Management', () => {
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

  it('should require sessionId for POST requests', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Host', 'localhost:3000')
      .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

    expect(res.status).toBe(400);
    // Updated error message from modern transport
    expect(res.body.error.message).toContain('Mcp-Session-Id');
  });

  it('should reject invalid sessionId', async () => {
    const res = await request(app)
      .post('/mcp')
      .set('Host', 'localhost:3000')
      .set('Mcp-Session-Id', 'non-existent-session')
      .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain('Session not found');
  });

  /**
   * Test: Session Timeout
   * Scenario: A session is inactive for longer than the configured timeout.
   * Expected: The session is removed from the manager and the transport is closed.
   */
  it('should expire sessions after timeout', async () => {
    // Use fake timers to control time
    vi.useFakeTimers();

    // Create a local app instance so SessionManager picks up the fake timers
    const { app: localApp, sessionManager } = createExpressApp(
      () =>
        new McpServer({
          name: 'test-server',
          version: PACKAGE_VERSION,
        }),
    );

    const sessionId = 'timeout-session-test';

    const mockTransport = {
      handleRequest: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };

    sessionManager.add(sessionId, mockTransport as any);

    expect(sessionManager.get(sessionId)).toBeDefined();

    // Advance time past timeout (30 mins) + cleanup interval (1 min)
    // We use a large buffer to be sure
    await vi.advanceTimersByTimeAsync(35 * 60 * 1000);

    // Verify session is gone
    expect(sessionManager.get(sessionId)).toBeUndefined();
    expect(mockTransport.close).toHaveBeenCalled();

    // Cleanup
    await sessionManager.closeAll();
    vi.useRealTimers();
  });
});
