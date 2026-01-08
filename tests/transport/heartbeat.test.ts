
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { TransportSessionManager } from '../../src/transport/session-manager.js';
import { createExpressApp } from '../../src/transport/http-server.js';
import { PACKAGE_VERSION } from './utils.js';

// Mock config to control timeouts
vi.mock('../../src/config/transport.config.js', async () => {
  const actual = await vi.importActual('../../src/config/transport.config.js');
  return {
    ...actual,
    // Short timeout for testing
    SESSION_TIMEOUT_MS: 1000, 
    SESSION_CLEANUP_INTERVAL_MS: 100,
    SESSION_KEEP_ALIVE_INTERVAL_MS: 200,
    SESSION_MAX_MISSED_HEARTBEATS: 3
  };
});

describe('MCP Transport Layer - Heartbeat & Liveness', () => {
  let app: express.Application;
  let sessionManager: TransportSessionManager;

  beforeEach(() => {
    vi.useFakeTimers();
    const mcpServerFactory = () => new McpServer({
      name: 'test-server',
      version: PACKAGE_VERSION
    });
    const setup = createExpressApp(mcpServerFactory);
    app = setup.app;
    sessionManager = setup.sessionManager;
  });

  afterEach(async () => {
    await sessionManager.closeAll();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should send heartbeat and keep session alive if transport is writable', async () => {
    const sessionId = 'active-session';
    
    // Mock a transport that accepts heartbeats
    const mockResponse = {
        write: vi.fn().mockReturnValue(true),
        writableEnded: false,
        destroyed: false
    };

    const mockTransport = {
        // Simulate the internal structure needed for sendHeartbeat
        _standaloneSseStreamId: 'stream-1',
        _streamMapping: new Map([['stream-1', mockResponse]]),
        
        // The method we are testing (copied logic or using the real class if possible, 
        // but here we mock the transport behavior to verify SessionManager logic)
        sendHeartbeat: vi.fn().mockReturnValue(true),
        close: vi.fn().mockResolvedValue(undefined)
    };

    // Add session manually
    sessionManager.add(sessionId, mockTransport as any);
    
    // Verify initial state
    expect(sessionManager.get(sessionId)).toBeDefined();

    // Advance time past timeout (1000ms)
    await vi.advanceTimersByTimeAsync(1500);

    // Verify:
    // 1. Session should STILL exist (because heartbeat succeeded)
    expect(sessionManager.get(sessionId)).toBeDefined();
    
    // 2. sendHeartbeat should have been called
    expect(mockTransport.sendHeartbeat).toHaveBeenCalled();
    
    // 3. close should NOT have been called
    expect(mockTransport.close).not.toHaveBeenCalled();
  });

  it('should close session if heartbeat fails (client disconnected)', async () => {
    const sessionId = 'dead-session';
    
    const mockTransport = {
        // sendHeartbeat returns false indicating failure
        sendHeartbeat: vi.fn().mockReturnValue(false),
        close: vi.fn().mockResolvedValue(undefined)
    };

    sessionManager.add(sessionId, mockTransport as any);
    
    // Advance time past timeout
    await vi.advanceTimersByTimeAsync(1500);

    // Verify:
    // 1. Session should be GONE
    expect(sessionManager.get(sessionId)).toBeUndefined();
    
    // 2. sendHeartbeat should have been called
    expect(mockTransport.sendHeartbeat).toHaveBeenCalled();
    
    // 3. close SHOULD have been called
    expect(mockTransport.close).toHaveBeenCalled();
  });

  it('should send active keep-alive heartbeats periodically', async () => {
    const sessionId = 'keep-alive-session';
    
    const mockTransport = {
        sendHeartbeat: vi.fn().mockReturnValue(true),
        close: vi.fn().mockResolvedValue(undefined)
    };

    sessionManager.add(sessionId, mockTransport as any);
    
    // Advance time by keep-alive interval (200ms)
    await vi.advanceTimersByTimeAsync(250);

    // Verify sendHeartbeat was called
    expect(mockTransport.sendHeartbeat).toHaveBeenCalled();
  });

  it('should tolerate missed heartbeats up to threshold', async () => {
    const sessionId = 'flaky-session';
    
    const mockTransport = {
        // sendHeartbeat returns false indicating failure
        sendHeartbeat: vi.fn().mockReturnValue(false),
        close: vi.fn().mockResolvedValue(undefined)
    };

    sessionManager.add(sessionId, mockTransport as any);
    
    // Advance by 750ms (t=750) -> Interval at 200, 400, 600 triggers
    // At 600 (3rd failure), session should be closed
    vi.advanceTimersByTime(750);
    
    expect(mockTransport.sendHeartbeat).toHaveBeenCalledTimes(3);
    expect(sessionManager.get(sessionId)).toBeUndefined();
    expect(mockTransport.close).toHaveBeenCalled();
  });

  it('should reset missed heartbeats on success', async () => {
    const sessionId = 'recovering-session';
    
    const mockTransport = {
        sendHeartbeat: vi.fn()
            .mockReturnValueOnce(false) // 1. Fail
            .mockReturnValueOnce(false) // 2. Fail
            .mockReturnValueOnce(true)  // 3. Success! (Reset)
            .mockReturnValueOnce(false), // 4. Fail (missed = 1)
        close: vi.fn().mockResolvedValue(undefined)
    };

    sessionManager.add(sessionId, mockTransport as any);
    
    // 1. Fail
    await vi.advanceTimersByTimeAsync(250);
    expect(sessionManager.get(sessionId)).toBeDefined();

    // 2. Fail
    await vi.advanceTimersByTimeAsync(200);
    expect(sessionManager.get(sessionId)).toBeDefined();

    // 3. Success (Should reset counter to 0)
    await vi.advanceTimersByTimeAsync(200);
    expect(sessionManager.get(sessionId)).toBeDefined();

    // 4. Fail (Counter becomes 1, not 3)
    await vi.advanceTimersByTimeAsync(200);
    expect(sessionManager.get(sessionId)).toBeDefined();
    
    // Even one more fail shouldn't kill it yet (Counter = 2)
    await vi.advanceTimersByTimeAsync(200);
    expect(sessionManager.get(sessionId)).toBeDefined();
  });
});
