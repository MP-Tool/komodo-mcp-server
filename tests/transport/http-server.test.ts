/**
 * HTTP Server Tests
 * 
 * Tests the server startup, port binding, and graceful shutdown lifecycle.
 * Verifies that the Express app is configured correctly and listens on the specified port.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { startHttpServer } from '../../src/transport/http-server.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Hoist mocks to allow access in tests
const { mockCloseAll } = vi.hoisted(() => ({
  mockCloseAll: vi.fn().mockResolvedValue(undefined)
}));

// Mock dependencies
const mockServer = {
  close: vi.fn((cb) => cb && cb())
};

const mockApp = {
  use: vi.fn(),
  post: vi.fn(),
  get: vi.fn(),
  listen: vi.fn().mockReturnValue(mockServer),
  disable: vi.fn()
};

// Mock express
vi.mock('express', () => {
  const express = () => mockApp;
  express.json = vi.fn();
  const router = {
    use: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    all: vi.fn()
  };
  express.Router = vi.fn().mockReturnValue(router);
  return { default: express, Router: express.Router };
});

// Mock config
vi.mock('../../src/config/env.js', () => ({
  config: {
    MCP_PORT: 3000,
    MCP_BIND_HOST: 'localhost'
  }
}));

// Mock SessionManager
vi.mock('../../src/transport/session-manager.js', () => {
  return {
    TransportSessionManager: class MockTransportSessionManager {
      closeAll = mockCloseAll;
    }
  };
});

describe('HTTP Server Lifecycle', () => {
  let processOnSpy: any;
  let processExitSpy: any;
  let consoleErrorSpy: any;
  let consoleLogSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    processOnSpy = vi.spyOn(process, 'on').mockImplementation(() => process);
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never);
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should start server and bind to configured port', async () => {
    const mockFactory = vi.fn() as unknown as () => McpServer;
    
    await startHttpServer(mockFactory);

    expect(mockApp.listen).toHaveBeenCalledWith(3000, 'localhost', expect.any(Function));
    
    // Verify startup log
    const listenCallback = mockApp.listen.mock.calls[0][2];
    listenCallback();
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Server listening')
    );
  });

  it('should handle graceful shutdown on SIGTERM', async () => {
    const mockFactory = vi.fn() as unknown as () => McpServer;
    await startHttpServer(mockFactory);

    // Find SIGTERM handler
    const sigtermHandler = processOnSpy.mock.calls.find((call: any) => call[0] === 'SIGTERM')?.[1];
    expect(sigtermHandler).toBeDefined();

    // Trigger shutdown
    await sigtermHandler();

    // Verify cleanup
    expect(mockCloseAll).toHaveBeenCalled();
    expect(mockServer.close).toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
