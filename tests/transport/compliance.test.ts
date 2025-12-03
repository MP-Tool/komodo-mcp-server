/**
 * MCP Transport Layer Compliance Tests
 * 
 * These tests verify that the server implementation complies with the Model Context Protocol (MCP) specification.
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
import { setupTestApp, cleanupTestApp, createSseRequest, LATEST_PROTOCOL_VERSION } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

// Suppress ECONNRESET
process.on('uncaughtException', (err: any) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message === 'aborted') {
    return;
  }
  console.error('Uncaught Exception in Test:', err);
});

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
   * Spec: Clients MUST send MCP-Protocol-Version header. Servers MUST validate it.
   */
  describe('Protocol Versioning (MCP-Protocol-Version)', () => {
    // Test all supported versions defined in config
    describe.each(SUPPORTED_PROTOCOL_VERSIONS)('Version %s', (version) => {
      it(`should accept valid protocol version ${version}`, async () => {
        await new Promise<void>((resolve, reject) => {
          const req = createSseRequest(app, version);

          req.on('response', (res) => {
            try {
              expect(res.statusCode).toBe(200);
              setTimeout(() => { req.abort(); resolve(); }, 10);
            } catch (e) { reject(e); }
          });
          
          req.on('error', (err: any) => {
            if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
          });
          
          req.end();
        });
      });
    });

    it(`should fallback to ${FALLBACK_PROTOCOL_VERSION} when header is missing`, async () => {
      // Legacy clients might not send the header
      await new Promise<void>((resolve, reject) => {
        const req = request(app)
          .get('/mcp')
          .set('Host', 'localhost:3000')
          .set('Accept', 'text/event-stream')
          .buffer(false);

        req.on('response', (res) => {
          try {
            expect(res.statusCode).toBe(200);
            setTimeout(() => { req.abort(); resolve(); }, 10);
          } catch (e) { reject(e); }
        });
        
        req.on('error', (err: any) => {
            if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
        });
        
        req.end();
      });
    });

    it('should reject unsupported protocol versions', async () => {
      const res = await request(app)
        .get('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', '1999-01-01')
        .set('Accept', 'text/event-stream');
        
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32600);
      expect(res.body.error.message).toContain('Unsupported MCP-Protocol-Version');
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
        await new Promise<void>((resolve, reject) => {
          const req = request(app)
            .get('/mcp')
            .set('Host', host)
            .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
            .set('Accept', 'text/event-stream')
            .buffer(false);

          req.on('response', (res) => {
            try {
              expect(res.statusCode).toBe(200);
              setTimeout(() => { req.abort(); resolve(); }, 10);
            } catch (e) { reject(e); }
          });
          
          req.on('error', (err: any) => {
            if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
          });
          
          req.end();
        });
      });
    });

    it('should reject requests with invalid Host header (DNS Rebinding)', async () => {
      const res = await request(app)
        .get('/mcp')
        .set('Host', 'evil.com')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'text/event-stream');
        
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe(-32000);
      expect(res.body.error.message).toContain('Invalid Host header');
    });
  });

  /**
   * Section: Content Negotiation
   * Spec: Clients MUST send Accept: text/event-stream for SSE connections.
   */
  describe('Content Negotiation (Accept Header)', () => {
    const validAccepts = ['text/event-stream', 'application/json'];

    describe.each(validAccepts)('Valid Accept: %s', (accept) => {
      it(`should accept request with Accept: ${accept}`, async () => {
        if (accept === 'application/json') {
             // POST requests use application/json
             const res = await request(app)
                .post('/mcp?sessionId=invalid')
                .set('Host', 'localhost:3000')
                .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
                .set('Accept', accept)
                .send({ jsonrpc: '2.0', method: 'ping', id: 1 });
                
             expect(res.status).toBe(404); // 404 is expected for invalid session, but means Accept was OK
        } else {
            // GET requests use text/event-stream
            await new Promise<void>((resolve, reject) => {
                const req = request(app)
                  .get('/mcp')
                  .set('Host', 'localhost:3000')
                  .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
                  .set('Accept', accept)
                  .buffer(false);
      
                req.on('response', (res) => {
                  try {
                    expect(res.statusCode).toBe(200);
                    setTimeout(() => { req.abort(); resolve(); }, 10);
                  } catch (e) { reject(e); }
                });
                
                req.on('error', (err: any) => {
                    if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
                });
                
                req.end();
              });
        }
      });
    });

    it('should reject requests with missing Accept header', async () => {
      const res = await request(app)
        .get('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .unset('Accept');
        
      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Missing Accept header');
    });

    it('should reject requests with invalid Accept header', async () => {
      const invalidAccepts = ['image/png'];
      
      for (const accept of invalidAccepts) {
        const res = await request(app)
            .get('/mcp')
            .set('Host', 'localhost:3000')
            .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
            .set('Accept', accept);
            
        expect(res.status).toBe(400);
        expect(res.body.error.message).toContain('Accept header must include');
      }
    });

    it('should accept requests with Accept: */*', async () => {
        await new Promise<void>((resolve, reject) => {
            const req = request(app)
                .get('/mcp')
                .set('Host', 'localhost:3000')
                .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
                .set('Accept', '*/*')
                .buffer(false);

            req.on('response', (res) => {
                try {
                    expect(res.statusCode).toBe(200);
                    req.abort();
                    resolve();
                } catch (e) {
                    req.abort();
                    reject(e);
                }
            });
            
            req.on('error', (err: any) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
            });
            
            req.end();
        });
    });
  });

  /**
   * Section: Message Compliance & Limits
   * Spec: JSON-RPC 2.0 compliance, size limits, rate limiting.
   */
  describe('Message Compliance & Limits', () => {
    let sessionId: string;

    beforeEach(async () => {
        sessionId = 'test-session-' + Date.now();
        
        const mockTransport = {
            handleRequest: vi.fn().mockImplementation(async (req, res) => {
                res.status(200).send('ok');
            }),
            close: vi.fn().mockResolvedValue(undefined)
        };
        
        sessionManager.add(sessionId, mockTransport as any);
    });

    it('should send "endpoint" event upon connection', async () => {
        await new Promise<void>((resolve, reject) => {
            const req = createSseRequest(app);

            req.on('response', (res) => {
                if (res.statusCode !== 200) {
                    let data = '';
                    res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
                    res.on('end', () => {
                        console.error('GET request failed:', res.statusCode, data);
                    });
                }
                expect(res.statusCode).toBe(200);
                
                res.on('data', (chunk: Buffer) => {
                    const text = chunk.toString();
                    if (text.includes('event: endpoint')) {
                        try {
                            expect(text).toContain('event: endpoint');
                            expect(text).toContain(`data: /mcp?sessionId=`);
                            req.abort();
                            resolve();
                        } catch (e) {
                            req.abort();
                            reject(e);
                        }
                    }
                });
            });
            
            req.on('error', (err: any) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
            });
            
            req.end();
        });
    });

    it('should reject malformed JSON payloads (Parse Error)', async () => {
        const res = await request(app)
            .post(`/mcp?sessionId=${sessionId}`)
            .set('Host', 'localhost:3000')
            .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
            .set('Content-Type', 'application/json')
            .send('{"jsonrpc": "2.0", "method": "ping", "id": 1'); // Missing closing brace

        expect(res.status).toBe(400);
    });

    it('should reject payloads exceeding size limit (100kb)', async () => {
        const largeData = 'a'.repeat(101 * 1024);
        const res = await request(app)
            .post(`/mcp?sessionId=${sessionId}`)
            .set('Host', 'localhost:3000')
            .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
            .set('Content-Type', 'application/json')
            .send({ jsonrpc: '2.0', method: 'ping', params: { data: largeData }, id: 1 });

        expect(res.status).toBe(413);
    });

    it('should include RateLimit headers', async () => {
        await new Promise<void>((resolve, reject) => {
            const req = createSseRequest(app);

            req.on('response', (res) => {
                try {
                    expect(res.headers['ratelimit-limit']).toBeDefined();
                    expect(res.headers['ratelimit-remaining']).toBeDefined();
                    expect(res.headers['ratelimit-reset']).toBeDefined();
                    req.abort();
                    resolve();
                } catch (e) {
                    req.abort();
                    reject(e);
                }
            });
            
            req.on('error', (err: any) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
            });
            
            req.end();
        });
    });

    it('should reject POST requests with invalid Content-Type', async () => {
      const res = await request(app)
        .post(`/mcp?sessionId=${sessionId}`)
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json')
        .set('Content-Type', 'text/plain')
        .send('{"jsonrpc": "2.0", "method": "ping", "id": 1}');

      expect(res.status).toBe(415);
    });

    it('should reject invalid JSON-RPC 2.0 messages', async () => {
      const res = await request(app)
        .post(`/mcp?sessionId=${sessionId}`)
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'application/json')
        .set('Content-Type', 'application/json')
        .send({ method: 'ping', id: 1 }); // Missing jsonrpc version

      expect(res.status).toBe(400);
      expect(res.body.error.message).toContain('Invalid JSON-RPC');
    });

    it('should return correct SSE headers', async () => {
        await new Promise<void>((resolve, reject) => {
            const req = createSseRequest(app);

            req.on('response', (res) => {
                try {
                    expect(res.statusCode).toBe(200);
                    expect(res.headers['content-type']).toBe('text/event-stream');
                    expect(res.headers['cache-control']).toContain('no-cache');
                    expect(res.headers['connection']).toBe('keep-alive');
                    req.abort();
                    resolve();
                } catch (e) {
                    req.abort();
                    reject(e);
                }
            });
            
            req.on('error', (err: any) => {
                if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
            });
            
            req.end();
        });
    });

    it('should handle internal transport errors gracefully', async () => {
        // Suppress console.error for this test as we expect an error log
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        try {
            const errorSessionId = 'error-session-' + Date.now();
            
            const mockErrorTransport = {
                handleRequest: vi.fn().mockRejectedValue(new Error('Transport failed')),
                close: vi.fn().mockResolvedValue(undefined)
            };
            
            sessionManager.add(errorSessionId, mockErrorTransport as any);

            const res = await request(app)
                .post(`/mcp?sessionId=${errorSessionId}`)
                .set('Host', 'localhost:3000')
                .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
                .set('Accept', 'application/json')
                .set('Content-Type', 'application/json')
                .send({ jsonrpc: '2.0', method: 'ping', id: 1 });

            expect(res.status).toBe(500);
            expect(res.body.error.code).toBe(-32603);
        } finally {
            consoleSpy.mockRestore();
        }
    });
  });

  describe('HTTP Method Constraints', () => {
    it('should reject unsupported HTTP methods (PUT)', async () => {
      const res = await request(app)
        .put('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'text/event-stream');
        
      expect(res.status).toBe(405);
    });

    it('should reject unsupported HTTP methods (DELETE)', async () => {
      const res = await request(app)
        .delete('/mcp')
        .set('Host', 'localhost:3000')
        .set('MCP-Protocol-Version', LATEST_PROTOCOL_VERSION)
        .set('Accept', 'text/event-stream');
        
      expect(res.status).toBe(405);
    });
  });
});

