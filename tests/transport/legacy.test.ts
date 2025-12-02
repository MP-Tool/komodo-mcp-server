/**
 * MCP Transport Layer - Legacy Client Compatibility Tests
 * 
 * These tests verify that the server correctly handles legacy clients that do not send the 
 * `MCP-Protocol-Version` header. The server should fallback to the configured legacy version.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestApp, cleanupTestApp, createSseRequest, LEGACY_PROTOCOL_VERSION } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

// Suppress ECONNRESET
process.on('uncaughtException', (err: any) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message === 'aborted') {
    return;
  }
  console.error('Uncaught Exception in Test:', err);
});

describe('MCP Transport Layer - Legacy Client Compatibility', () => {
  let app: express.Application;

  beforeEach(() => {
    app = setupTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
  });

  /**
   * Test: Full Legacy Connection Flow
   * Scenario: Client connects without MCP-Protocol-Version header.
   * Expected: Server accepts connection, sends endpoint event, and accepts subsequent POSTs.
   */
  it('should support full legacy connection flow (No Version Header)', async () => {
      // 1. Initial GET request (Handshake)
      // Legacy clients do not send MCP-Protocol-Version
      let sessionId: string | undefined;
      let endpoint: string | undefined;

      await new Promise<void>((resolve, reject) => {
          const req = request(app)
              .get('/mcp')
              .set('Host', 'localhost:3000')
              // No MCP-Protocol-Version
              .set('Accept', 'text/event-stream')
              .buffer(false);

          req.on('response', (res) => {
              expect(res.statusCode).toBe(200);
              
              res.on('data', (chunk: Buffer) => {
                  const text = chunk.toString();
                  if (text.includes('event: endpoint')) {
                      // Extract session ID and endpoint from the event data
                      // Format: data: /mcp?sessionId=...
                      const match = text.match(/data: (.+)\n/);
                      if (match) {
                          endpoint = match[1];
                          const urlParams = new URLSearchParams(endpoint.split('?')[1]);
                          sessionId = urlParams.get('sessionId') || undefined;
                          
                          req.abort();
                          resolve();
                      }
                  }
              });
          });
          
          req.on('error', (err: any) => {
              if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
          });
          
          req.end();
      });

      expect(sessionId).toBeDefined();
      expect(endpoint).toBeDefined();

      // 2. Subsequent POST request (Message)
      // Legacy clients use the endpoint provided in the event
      // We must send 'initialize' first because the server expects it
      const res = await request(app)
          .post(endpoint!)
          .set('Host', 'localhost:3000')
          // Legacy might not send version here either, or sends the fallback
          // We test without header to ensure consistency
          // .set('Accept', 'text/event-stream')
          .set('Content-Type', 'application/json')
          .send({ 
              jsonrpc: '2.0', 
              method: 'initialize', 
              params: {
                  protocolVersion: LEGACY_PROTOCOL_VERSION,
                  capabilities: {},
                  clientInfo: { name: 'test', version: '1.0' }
              },
              id: 1 
          });

      expect(res.status).toBe(202);
  });

  /**
   * Test: Explicit Legacy Version
   * Scenario: Client sends explicit legacy version header.
   * Expected: Server accepts connection.
   */
  it(`should support explicit legacy version (${LEGACY_PROTOCOL_VERSION})`, async () => {
      await new Promise<void>((resolve, reject) => {
          const req = createSseRequest(app, LEGACY_PROTOCOL_VERSION);

          req.on('response', (res) => {
              expect(res.statusCode).toBe(200);
              req.abort();
              resolve();
          });
          
          req.on('error', (err: any) => {
              if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') reject(err);
          });
          
          req.end();
      });
  });
});

