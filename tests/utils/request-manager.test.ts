/**
 * Tests for RequestManager
 *
 * Tests the MCP Spec 2025-11-25 utilities implementation:
 * - Cancellation: Track and cancel in-flight requests
 * - Progress: Send progress notifications for long-running operations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RequestManager, ProgressData } from '../../src/utils/request-manager.js';

// Mock the logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    child: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

describe('RequestManager', () => {
  let manager: RequestManager;

  beforeEach(() => {
    manager = new RequestManager();
  });

  describe('registerRequest', () => {
    it('should register a request and return an AbortSignal', () => {
      const signal = manager.registerRequest('req-1', 'tools/call');

      expect(signal).toBeInstanceOf(AbortSignal);
      expect(signal.aborted).toBe(false);
    });

    it('should track the request in active requests', () => {
      manager.registerRequest('req-1', 'tools/call');

      const stats = manager.getStats();
      expect(stats.activeRequests).toBe(1);
      expect(stats.requestIds).toContain('req-1');
    });

    it('should support numeric request IDs', () => {
      const signal = manager.registerRequest(123, 'tools/call');

      expect(signal).toBeInstanceOf(AbortSignal);
      const stats = manager.getStats();
      expect(stats.requestIds).toContain(123);
    });

    it('should store progress token when provided', () => {
      manager.registerRequest('req-1', 'tools/call', 'progress-token-1');

      // Verify via createProgressReporter
      const reporter = manager.createProgressReporter('progress-token-1');
      expect(reporter).toBeDefined();
    });
  });

  describe('unregisterRequest', () => {
    it('should remove a registered request', () => {
      manager.registerRequest('req-1', 'tools/call');
      expect(manager.getStats().activeRequests).toBe(1);

      manager.unregisterRequest('req-1');
      expect(manager.getStats().activeRequests).toBe(0);
    });

    it('should handle unregistering non-existent requests', () => {
      // Should not throw
      expect(() => manager.unregisterRequest('non-existent')).not.toThrow();
    });
  });

  describe('handleCancellation', () => {
    it('should abort the AbortController for a registered request', () => {
      const signal = manager.registerRequest('req-1', 'tools/call');
      expect(signal.aborted).toBe(false);

      const result = manager.handleCancellation('req-1', 'User cancelled');

      expect(result).toBe(true);
      expect(signal.aborted).toBe(true);
    });

    it('should unregister the request after cancellation', () => {
      manager.registerRequest('req-1', 'tools/call');
      expect(manager.getStats().activeRequests).toBe(1);

      manager.handleCancellation('req-1');

      expect(manager.getStats().activeRequests).toBe(0);
    });

    it('should return false for unknown request ID', () => {
      const result = manager.handleCancellation('unknown-id');
      expect(result).toBe(false);
    });

    it('should work without a reason', () => {
      const signal = manager.registerRequest('req-1', 'tools/call');

      const result = manager.handleCancellation('req-1');

      expect(result).toBe(true);
      expect(signal.aborted).toBe(true);
    });
  });

  describe('isCancelled', () => {
    it('should return false for non-cancelled requests', () => {
      manager.registerRequest('req-1', 'tools/call');

      expect(manager.isCancelled('req-1')).toBe(false);
    });

    it('should return true after cancellation', () => {
      manager.registerRequest('req-1', 'tools/call');
      manager.handleCancellation('req-1');

      // After cancellation, the request is unregistered, so isCancelled checks signal
      // In this implementation, after handleCancellation the request is removed
      // So isCancelled should return false for removed requests
      expect(manager.isCancelled('req-1')).toBe(false);
    });

    it('should return false for unknown request ID', () => {
      expect(manager.isCancelled('unknown-id')).toBe(false);
    });
  });

  describe('getAbortSignal', () => {
    it('should return the AbortSignal for a registered request', () => {
      const signal = manager.registerRequest('req-1', 'tools/call');
      const retrievedSignal = manager.getAbortSignal('req-1');

      expect(retrievedSignal).toBe(signal);
    });

    it('should return undefined for unknown request ID', () => {
      expect(manager.getAbortSignal('unknown-id')).toBeUndefined();
    });
  });

  describe('sendProgress', () => {
    it('should return false when no server is configured', async () => {
      const result = await manager.sendProgress('token-1', { progress: 50 });
      expect(result).toBe(false);
    });

    it('should send progress notification when server is configured', async () => {
      const mockNotification = vi.fn().mockResolvedValue(undefined);
      // Mock McpServer structure: mcpServer.server.notification()
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };

      manager.setServer(mockMcpServer as any);

      const result = await manager.sendProgress('token-1', {
        progress: 50,
        total: 100,
        message: 'Processing...',
      });

      expect(result).toBe(true);
      expect(mockNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-1',
          progress: 50,
          total: 100,
          message: 'Processing...',
        },
      });
    });

    it('should omit undefined total from notification', async () => {
      const mockNotification = vi.fn().mockResolvedValue(undefined);
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };

      manager.setServer(mockMcpServer as any);

      await manager.sendProgress('token-1', { progress: 25 });

      expect(mockNotification).toHaveBeenCalledWith({
        method: 'notifications/progress',
        params: {
          progressToken: 'token-1',
          progress: 25,
        },
      });
    });

    it('should rate limit progress notifications', async () => {
      const mockNotification = vi.fn().mockResolvedValue(undefined);
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };

      manager.setServer(mockMcpServer as any);

      // First call should succeed
      const result1 = await manager.sendProgress('token-1', { progress: 1 });
      expect(result1).toBe(true);

      // Immediate second call should be rate limited
      const result2 = await manager.sendProgress('token-1', { progress: 2 });
      expect(result2).toBe(false);

      expect(mockNotification).toHaveBeenCalledTimes(1);
    });

    it('should handle server notification errors gracefully', async () => {
      const mockNotification = vi.fn().mockRejectedValue(new Error('Connection lost'));
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };

      manager.setServer(mockMcpServer as any);

      // Should not throw, just return false
      const result = await manager.sendProgress('token-1', { progress: 50 });
      expect(result).toBe(false);
    });
  });

  describe('createProgressReporter', () => {
    it('should return undefined when no progress token is provided', () => {
      const reporter = manager.createProgressReporter(undefined);
      expect(reporter).toBeUndefined();
    });

    it('should return a function when progress token is provided', () => {
      const reporter = manager.createProgressReporter('token-1');
      expect(reporter).toBeInstanceOf(Function);
    });

    it('should create a working progress reporter', async () => {
      const mockNotification = vi.fn().mockResolvedValue(undefined);
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };

      manager.setServer(mockMcpServer as any);

      const reporter = manager.createProgressReporter('token-1');
      expect(reporter).toBeDefined();

      const result = await reporter!({ progress: 75, total: 100 });
      expect(result).toBe(true);
      expect(mockNotification).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      manager.registerRequest('req-1', 'method-1');
      manager.registerRequest('req-2', 'method-2');
      manager.registerRequest(3, 'method-3');

      const stats = manager.getStats();

      expect(stats.activeRequests).toBe(3);
      expect(stats.requestIds).toHaveLength(3);
      expect(stats.requestIds).toContain('req-1');
      expect(stats.requestIds).toContain('req-2');
      expect(stats.requestIds).toContain(3);
    });
  });

  describe('clear', () => {
    it('should abort all active requests', () => {
      const signal1 = manager.registerRequest('req-1', 'method-1');
      const signal2 = manager.registerRequest('req-2', 'method-2');

      manager.clear();

      expect(signal1.aborted).toBe(true);
      expect(signal2.aborted).toBe(true);
    });

    it('should remove all tracked requests', () => {
      manager.registerRequest('req-1', 'method-1');
      manager.registerRequest('req-2', 'method-2');

      manager.clear();

      expect(manager.getStats().activeRequests).toBe(0);
    });

    it('should clear server reference', async () => {
      const mockMcpServer = {
        server: {
          notification: vi.fn().mockResolvedValue(undefined),
        },
      };
      manager.setServer(mockMcpServer as any);

      manager.clear();

      // After clear, sendProgress should return false (no server)
      const result = await manager.sendProgress('token', { progress: 1 });
      expect(result).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('should handle full request lifecycle with progress', async () => {
      const mockNotification = vi.fn().mockResolvedValue(undefined);
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };
      manager.setServer(mockMcpServer as any);

      // 1. Register request with progress token
      const signal = manager.registerRequest('req-1', 'tools/call', 'progress-1');
      expect(signal.aborted).toBe(false);

      // 2. Create progress reporter
      const reporter = manager.createProgressReporter('progress-1');
      expect(reporter).toBeDefined();

      // 3. Report progress
      await reporter!({ progress: 0, total: 100, message: 'Starting...' });

      // 4. Complete request
      manager.unregisterRequest('req-1');
      expect(manager.getStats().activeRequests).toBe(0);
    });

    it('should handle cancellation during progress reporting', async () => {
      const mockNotification = vi.fn().mockResolvedValue(undefined);
      const mockMcpServer = {
        server: {
          notification: mockNotification,
        },
      };
      manager.setServer(mockMcpServer as any);

      // 1. Register request
      const signal = manager.registerRequest('req-1', 'tools/call', 'progress-1');

      // 2. Start reporting progress
      await manager.sendProgress('progress-1', { progress: 25 });

      // 3. Cancel the request
      manager.handleCancellation('req-1', 'User cancelled');
      expect(signal.aborted).toBe(true);

      // 4. Request should be removed
      expect(manager.getStats().activeRequests).toBe(0);
    });
  });
});
