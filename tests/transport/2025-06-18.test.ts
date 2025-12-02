/**
 * MCP Transport Layer - Modern Client Compatibility Tests (2025-06-18)
 * 
 * These tests verify that the server correctly handles clients using the 2025-06-18 protocol version.
 * This version introduced stricter header requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestApp, cleanupTestApp, createSseRequest, PROTOCOL_VERSION_2025_06_18 } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

// Suppress ECONNRESET
process.on('uncaughtException', (err: any) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message === 'aborted') {
    return;
  }
  console.error('Uncaught Exception in Test:', err);
});

describe('MCP Transport Layer - Modern Client Compatibility (2025-06-18)', () => {
  let app: express.Application;

  beforeEach(() => {
    app = setupTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
  });

  /**
   * Test: Full Modern Connection Flow
   * Scenario: Client connects with MCP-Protocol-Version: 2025-06-18.
   * Expected: Server accepts connection, sends endpoint event, and accepts subsequent POSTs with the same version header.
   */
  it(`should support full modern connection flow (${PROTOCOL_VERSION_2025_06_18})`, async () => {
      // 1. Initial GET request
      let sessionId: string | undefined;
      let endpoint: string | undefined;

      await new Promise<void>((resolve, reject) => {
          const req = createSseRequest(app, PROTOCOL_VERSION_2025_06_18);

          req.on('response', (res) => {
              expect(res.statusCode).toBe(200);
              
              res.on('data', (chunk: Buffer) => {
                  const text = chunk.toString();
                  if (text.includes('event: endpoint')) {
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

      // 2. Subsequent POST request
      // We must send 'initialize' first because the server expects it
      const res = await request(app)
          .post(endpoint!)
          .set('Host', 'localhost:3000')
          .set('MCP-Protocol-Version', PROTOCOL_VERSION_2025_06_18)
          // .set('Accept', 'text/event-stream')
          .set('Content-Type', 'application/json')
          .send({ 
              jsonrpc: '2.0', 
              method: 'initialize', 
              params: {
                  protocolVersion: PROTOCOL_VERSION_2025_06_18,
                  capabilities: {},
                  clientInfo: { name: 'test', version: '1.0' }
              },
              id: 1 
          });

      expect(res.status).toBe(202);
  });
});

