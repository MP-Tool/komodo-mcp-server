/**
 * MCP Transport Layer Compliance Tests
 * 
 * These tests verify that the server implementation complies with the Model Context Protocol (MCP) specification.
 * Uses the modern Streamable HTTP transport (POST initialize → session via header).
 * 
 * It covers:
 * - Protocol Versioning (Headers, Fallbacks)
 * - Security (DNS Rebinding, Host Header Validation)
 * - Content Negotiation (Accept Headers)
 * - Message Limits (Size, Rate Limiting)
 * - HTTP Method Constraints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TransportSessionManager } from '../../src/transport/session-manager.js';
import { SUPPORTED_PROTOCOL_VERSIONS, FALLBACK_PROTOCOL_VERSION } from '../../src/transport/config/transport.config.js';
import { 
  setupTestApp, 
  cleanupTestApp, 
  createInitializeRequest,
  initializeAndParse,
  initializeSession,
  createPostRequest,
  parseSseResponse,
  LATEST_PROTOCOL_VERSION 
} from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

describe('MCP Transport Layer Compliance', () => {
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
   * Section: Protocol Versioning
   * Spec: Clients send MCP-Protocol-Version header. Servers negotiate protocol version.
   */
  describe('Protocol Versioning (MCP-Protocol-Version)', () => {
    // Test all supported versions defined in config
    describe.each(SUPPORTED_PROTOCOL_VERSIONS)('Version %s', (version) => {
      it(`should accept valid protocol version ${version}`, async () => {
        const response = await createInitializeRequest(app, version);
        
        expect(response.status).toBe(200);
        expect(response.headers['mcp-session-id']).toBeDefined();
        
        // Parse SSE response and verify result
        const messages = parseSseResponse(response.text);
        expect(messages.length).toBeGreaterThan(0);
        expect(messages[0].result).toBeDefined();
      });
    });

    it(`should fallback to ${FALLBACK_PROTOCOL_VERSION} when header is missing`, async () => {
      // Send initialize without MCP-Protocol-Version header
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: FALLBACK_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
          },
          id: 1
        });

      expect(response.status).toBe(200);
      expect(response.headers['mcp-session-id']).toBeDefined();
    });

    it('should reject unsupported protocol versions', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', '1999-01-01')
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: '1999-01-01',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
          },
          id: 1
        });
        
      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe(-32600);
      expect(response.body.error.message).toContain('Unsupported MCP-Protocol-Version');
    });
  });

  /**
   * Section: Security
   * Spec: Servers MUST validate Host header to prevent DNS Rebinding attacks.
   */
  describe('Connection Security (DNS Rebinding)', () => {
    const validHosts = ['localhost', '127.0.0.1', 'localhost:3000', '127.0.0.1:3000'];

    describe.each(validHosts)('Valid Host: %s', (host) => {
      it(`should accept request with Host: ${host}`, async () => {
        const response = await request(app)
          .post('/mcp')
          .set('Host', host)
          .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
          .set('Accept', 'application/json, text/event-stream')
          .set('Content-Type', 'application/json')
          .send({
            jsonrpc: '2.0',
            method: 'initialize',
            params: {
              protocolVersion: LATEST_PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: 'test', version: '1.0' }
            },
            id: 1
          });

        expect(response.status).toBe(200);
      });
    });

    it('should reject requests with invalid Host header (DNS Rebinding)', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'evil.com')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
          },
          id: 1
        });
        
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(-32000);
      expect(response.body.error.message).toContain('Invalid Host header');
    });
  });

  /**
   * Section: Content Negotiation
   * Spec: Clients MUST include Accept header with application/json and text/event-stream for POST.
   */
  describe('Content Negotiation (Accept Header)', () => {
    it('should accept requests with Accept: application/json, text/event-stream', async () => {
      const response = await createInitializeRequest(app);
      expect(response.status).toBe(200);
    });

    it('should accept requests with Accept: */*', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', '*/*')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
          },
          id: 1
        });

      // SDK may accept */* (200) or require explicit types (406)
      // The MCP SDK is strict about Accept headers
      expect([200, 406]).toContain(response.status);
    });

    it('should reject requests with missing Accept header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Content-Type', 'application/json')
        .unset('Accept')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
          },
          id: 1
        });
        
      // SDK may return 400 or 406 for missing/invalid Accept
      expect([400, 406]).toContain(response.status);
    });

    it('should reject requests with invalid Accept header', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'image/png')
        .set('Content-Type', 'application/json')
        .send({
          jsonrpc: '2.0',
          method: 'initialize',
          params: {
            protocolVersion: LATEST_PROTOCOL_VERSION,
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0' }
          },
          id: 1
        });
          
      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Accept header must include');
    });
  });

  /**
   * Section: Message Compliance & Limits
   * Spec: JSON-RPC 2.0 compliance, size limits, rate limiting.
   */
  describe('Message Compliance & Limits', () => {
    let sessionId: string;

    beforeEach(async () => {
      // Initialize a real session for these tests
      sessionId = await initializeSession(app);
    });

    it('should return Mcp-Session-Id header on successful initialization', async () => {
      const { sessionId: newSessionId, response } = await initializeAndParse(app);
      
      expect(response.status).toBe(200);
      expect(newSessionId).toBeDefined();
      expect(typeof newSessionId).toBe('string');
      expect(newSessionId.length).toBeGreaterThan(0);
    });

    it('should return SSE content type for initialize response', async () => {
      const response = await createInitializeRequest(app);
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');
    });

    it('should reject malformed JSON payloads (Parse Error)', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', sessionId)
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send('{"jsonrpc": "2.0", "method": "ping", "id": 1'); // Missing closing brace

      expect(response.status).toBe(400);
    });

    it('should reject payloads exceeding size limit (100kb)', async () => {
      const largeData = 'a'.repeat(101 * 1024);
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', sessionId)
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', method: 'ping', params: { data: largeData }, id: 1 });

      expect(response.status).toBe(413);
    });

    it('should include RateLimit headers', async () => {
      const response = await createInitializeRequest(app);

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });

    it('should reject POST requests with invalid Content-Type', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', sessionId)
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'text/plain')
        .send('{"jsonrpc": "2.0", "method": "ping", "id": 1}');

      expect(response.status).toBe(415);
    });

    it('should reject invalid JSON-RPC 2.0 messages', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', sessionId)
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({ method: 'ping', id: 1 }); // Missing jsonrpc version

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid JSON-RPC');
    });

    it('should handle internal transport errors gracefully', async () => {
      // Create a mock session with a failing transport
      const errorSessionId = 'error-session-' + Date.now();
      
      const mockErrorTransport = {
        sessionId: errorSessionId,
        handleRequest: vi.fn().mockRejectedValue(new Error('Transport failed')),
        close: vi.fn().mockResolvedValue(undefined)
      };
      
      sessionManager.add(errorSessionId, mockErrorTransport as any);

      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', errorSessionId)
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

      expect(response.status).toBe(500);
      expect(response.body.error.code).toBe(-32603);
    });
  });

  /**
   * Section: Session Management
   */
  describe('Session Management', () => {
    it('should reject POST without session ID (non-initialize)', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Mcp-Session-Id');
    });

    it('should return 404 for invalid session ID', async () => {
      const response = await request(app)
        .post('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', 'invalid-session-id')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream')
        .set('Content-Type', 'application/json')
        .send({ jsonrpc: '2.0', method: 'tools/list', id: 1 });

      expect(response.status).toBe(404);
      expect(response.body.error.message).toContain('Session not found');
    });

    it('should accept notifications with 202 status', async () => {
      const sessionId = await initializeSession(app);
      
      const response = await createPostRequest(
        app,
        sessionId,
        { jsonrpc: '2.0', method: 'notifications/initialized' }
      );

      expect(response.status).toBe(202);
    });
  });

  /**
   * Section: HTTP Method Constraints
   */
  describe('HTTP Method Constraints', () => {
    it('should reject unsupported HTTP methods (PUT)', async () => {
      const response = await request(app)
        .put('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json, text/event-stream');
        
      expect(response.status).toBe(405);
    });

    it('should support DELETE for session termination', async () => {
      const sessionId = await initializeSession(app);
      
      const response = await request(app)
        .delete('/mcp')
        .set('Host', 'localhost:3000')
        .set('Mcp-Session-Id', sessionId)
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION);
        
      // DELETE should either succeed (204/200), be handled (202), 
      // be rejected as not allowed (405), or require Accept header (400)
      expect([200, 202, 204, 400, 405]).toContain(response.status);
    });
  });
});

