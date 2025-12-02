/**
 * MCP Transport Layer - Split Stream Transport Tests
 * 
 * These tests verify the "split stream" transport pattern where the SSE connection (GET) 
 * and message sending (POST) are handled separately. This pattern is used by several 
 * MCP clients (including VS Code) and requires specific handling of session IDs 
 * and connection persistence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestApp, cleanupTestApp } from './utils.js';

// Mock config
vi.mock('../../src/config/env.js', () => import('./mocks/env.js'));

// Suppress ECONNRESET
process.on('uncaughtException', (err: any) => {
  if (err.code === 'ECONNRESET' || err.code === 'ECONNABORTED' || err.message === 'aborted') {
    return;
  }
  console.error('Uncaught Exception in Test:', err);
});

describe('MCP Transport Layer - Split Stream Transport', () => {
  let app: express.Application;

  beforeEach(() => {
    app = setupTestApp();
  });

  afterEach(async () => {
    await cleanupTestApp(app);
  });

  /**
   * Test: Split Stream Persistence
   * Scenario: 
   * 1. Client establishes SSE connection (GET).
   * 2. Client sends POST request with session ID.
   * Expected: The SSE connection MUST remain open and receive responses from the POST request.
   */
  it('should maintain SSE connection open after multiple POST requests', async () => {
    let sessionId: string | undefined;
    let sseResponse: any;
    const receivedEvents: string[] = [];

    // 1. Establish SSE Connection (GET)
    const ssePromise = new Promise<void>((resolve, reject) => {
      const req = request(app)
        .get('/mcp')
        .set('Accept', 'text/event-stream')
        .buffer(false);

      req.on('response', (res) => {
        expect(res.statusCode).toBe(200);
        sseResponse = res;

        res.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          receivedEvents.push(text);

          // Extract Session ID from endpoint event
          if (text.includes('event: endpoint')) {
            const match = text.match(/sessionId=([a-zA-Z0-9-]+)/);
            if (match) {
              sessionId = match[1];
              resolve();
            }
          }
        });
      });

      req.on('error', (err) => {
        if (err.code !== 'ECONNRESET' && err.code !== 'ECONNABORTED') {
            reject(err);
        }
      });
      
      req.end();
    });

    await ssePromise;
    expect(sessionId).toBeDefined();

    // 2. Send Initialize Request (POST)
    // Client sends this as a separate POST request
    const initResponse = await request(app)
      .post(`/mcp?sessionId=${sessionId}`)
      .set('Content-Type', 'application/json')
      .set('Accept', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0' }
        }
      });

    // Expect 202 Accepted (as per our fix for split stream)
    expect(initResponse.statusCode).toBe(202);


    // Wait for response on SSE stream
    await new Promise(resolve => setTimeout(resolve, 100));

    
    // Check if we received the initialize response on SSE
    const initEvent = receivedEvents.find(e => e.includes('"id":1'));
    expect(initEvent).toBeDefined();
    expect(initEvent).toContain('result');

    // 3. Send Initialized Notification (POST)
    const notifiedResponse = await request(app)
      .post(`/mcp?sessionId=${sessionId}`)
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        method: 'notifications/initialized'
      });
    
    expect(notifiedResponse.statusCode).toBe(202);

    // 4. Send a Tool List Request (POST)
    // This was failing before the fix (Stream was closed)
    const toolsResponse = await request(app)
      .post(`/mcp?sessionId=${sessionId}`)
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
      });

    expect(toolsResponse.statusCode).toBe(202);

    // Wait for response
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check if we received the tools list response on SSE
    const toolsEvent = receivedEvents.find(e => e.includes('"id":2'));
    expect(toolsEvent).toBeDefined();
  });
});
