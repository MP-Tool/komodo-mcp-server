/**
 * Modern Streamable HTTP Transport Tests (2025-03-26)
 *
 * Tests the modern transport pattern:
 * 1. POST /mcp with InitializeRequest → Creates session, returns Mcp-Session-Id header
 * 2. POST /mcp with Mcp-Session-Id header → Reuses existing session
 * 3. GET /mcp with Mcp-Session-Id header → SSE stream for notifications
 * 4. DELETE /mcp with Mcp-Session-Id header → Terminates session
 *
 * For legacy HTTP+SSE (2024-11-05) tests, see legacy-sse.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import type express from 'express';
import { TransportSessionManager } from '../../src/transport/session-manager.js';
import { setupTestApp, parseSseResponse } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

describe('Modern Streamable HTTP Transport (2025-03-26)', () => {
  let app: express.Application;
  let sessionManager: TransportSessionManager;

  beforeEach(() => {
    const setup = setupTestApp();
    app = setup.app;
    sessionManager = setup.sessionManager;
  });

  describe('GET /mcp without session (Legacy SSE fallback)', () => {
    it.skip('should return SSE endpoint event for legacy transport fallback', async () => {
      // SKIP: SSE streaming tests are difficult to test with supertest because:
      // 1. The SSE stream stays open indefinitely
      // 2. supertest waits for the response to complete
      // 3. We cannot easily abort the request in a cross-platform way
      //
      // This functionality is tested via integration tests with actual EventSource clients.
      // The /mcp endpoint for legacy SSE is verified to work via Docker container testing.
    });
  });

  describe('POST /mcp initialize → create session', () => {
    it('should create session via POST initialize without session ID', async () => {
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const response = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeRequest)
        .expect(200);

      // SDK returns SSE format
      expect(response.headers['content-type']).toContain('text/event-stream');

      // Parse SSE response
      const messages = parseSseResponse(response.text);
      expect(messages.length).toBeGreaterThan(0);

      const initResponse = messages[0];
      expect(initResponse.result).toBeDefined();
      expect(initResponse.result?.protocolVersion).toBe('2024-11-05');
      expect(initResponse.result?.serverInfo).toBeDefined();

      // Session ID should be in header
      const sessionId = response.headers['mcp-session-id'];
      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
    });
  });

  describe('POST /mcp with Mcp-Session-Id header → reuse session', () => {
    it('should prioritize Mcp-Session-Id header over ?sessionId query parameter', async () => {
      // Create session
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'test-client',
            version: '1.0.0',
          },
        },
      };

      const initResponse = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeRequest)
        .expect(200);

      const sessionId = initResponse.headers['mcp-session-id'];

      // Send request with BOTH header and query parameter
      const pingRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      };

      const pingResponse = await request(app)
        .post(`/mcp?sessionId=wrong-id`)
        .set('Mcp-Session-Id', sessionId)
        .set('Accept', 'application/json, text/event-stream')
        .send(pingRequest)
        .expect(200);

      // Should succeed because header takes priority
      const messages = parseSseResponse(pingResponse.text);
      expect(messages.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid ?sessionId (legacy query parameter not supported)', async () => {
      const pingRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      };

      // Legacy ?sessionId query parameter is not supported in modern transport
      // The server returns 400 Bad Request because sessionId must be in header
      await request(app).post('/mcp?sessionId=invalid-session-id').send(pingRequest).expect(400);
    });
  });

  describe('Full modern flow integration', () => {
    it('should complete full modern flow: POST initialize → POST with header', async () => {
      // Step 1: POST initialize to create session
      const initializeRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'modern-client',
            version: '1.0.0',
          },
        },
      };

      const initResponse = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(initializeRequest)
        .expect(200);

      const sessionId = initResponse.headers['mcp-session-id'];
      expect(sessionId).toBeDefined();

      // Step 2: Use session with Mcp-Session-Id header to send ping
      const pingRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      };

      const pingResponse = await request(app)
        .post('/mcp')
        .set('Mcp-Session-Id', sessionId)
        .set('Accept', 'application/json, text/event-stream')
        .send(pingRequest)
        .expect(200);

      const messages = parseSseResponse(pingResponse.text);
      expect(messages.length).toBeGreaterThan(0);

      // Ping should return an empty result object
      const pingResult = messages[0];
      expect(pingResult.result).toBeDefined();
    });
  });

  describe('Multiple sessions', () => {
    it('should support multiple independent sessions', async () => {
      const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: {
            name: 'multi-session-client',
            version: '1.0.0',
          },
        },
      };

      // Create Session 1
      const session1Response = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(initRequest)
        .expect(200);

      const session1Id = session1Response.headers['mcp-session-id'];

      // Create Session 2
      const session2Response = await request(app)
        .post('/mcp')
        .set('Accept', 'application/json, text/event-stream')
        .send(initRequest)
        .expect(200);

      const session2Id = session2Response.headers['mcp-session-id'];

      // Sessions should be different
      expect(session1Id).not.toBe(session2Id);

      // Both sessions should work independently
      const pingRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'ping',
      };

      await request(app)
        .post('/mcp')
        .set('Mcp-Session-Id', session1Id)
        .set('Accept', 'application/json, text/event-stream')
        .send(pingRequest)
        .expect(200);

      await request(app)
        .post('/mcp')
        .set('Mcp-Session-Id', session2Id)
        .set('Accept', 'application/json, text/event-stream')
        .send(pingRequest)
        .expect(200);
    });
  });
});
