/**
 * Tests for ConnectionStateManager
 *
 * Tests the connection state management including:
 * - State transitions (disconnected → connecting → connected → error)
 * - Listener notifications
 * - Health check validation during connect
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionStateManager } from '../../src/utils/connection-state.js';
import { KomodoClient } from '../../src/api/index.js';

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

describe('ConnectionStateManager', () => {
  let manager: ConnectionStateManager;

  beforeEach(() => {
    manager = new ConnectionStateManager();
  });

  describe('initial state', () => {
    it('should start in disconnected state', () => {
      expect(manager.getState()).toBe('disconnected');
    });

    it('should have no client initially', () => {
      expect(manager.getClient()).toBeNull();
    });

    it('should not be connected initially', () => {
      expect(manager.isConnected()).toBe(false);
    });

    it('should have no errors initially', () => {
      expect(manager.getLastError()).toBeNull();
    });

    it('should have empty history initially', () => {
      expect(manager.getHistory()).toHaveLength(0);
    });
  });

  describe('setConnecting', () => {
    it('should transition to connecting state', () => {
      manager.setConnecting();
      expect(manager.getState()).toBe('connecting');
    });

    it('should add to history', () => {
      manager.setConnecting();
      const history = manager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].previousState).toBe('disconnected');
      expect(history[0].currentState).toBe('connecting');
    });
  });

  describe('connect', () => {
    it('should transition to connected on successful health check', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue({
          status: 'healthy',
          message: 'OK',
          details: { url: 'http://localhost:9120', apiVersion: '1.0.0' },
        }),
      } as unknown as KomodoClient;

      const success = await manager.connect(mockClient);

      expect(success).toBe(true);
      expect(manager.getState()).toBe('connected');
      expect(manager.getClient()).toBe(mockClient);
      expect(manager.isConnected()).toBe(true);
    });

    it('should transition to error on failed health check', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue({
          status: 'unhealthy',
          message: 'Connection refused',
          details: {},
        }),
      } as unknown as KomodoClient;

      const success = await manager.connect(mockClient);

      expect(success).toBe(false);
      expect(manager.getState()).toBe('error');
      expect(manager.getClient()).toBeNull();
      expect(manager.isConnected()).toBe(false);
      expect(manager.getLastError()).toBeTruthy();
    });

    it('should transition to error when health check throws', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as KomodoClient;

      const success = await manager.connect(mockClient);

      expect(success).toBe(false);
      expect(manager.getState()).toBe('error');
      expect(manager.getLastError()?.message).toBe('Network error');
    });

    it('should skip health check when skipHealthCheck is true', async () => {
      const mockClient = {
        healthCheck: vi.fn(),
      } as unknown as KomodoClient;

      const success = await manager.connect(mockClient, true);

      expect(success).toBe(true);
      expect(manager.getState()).toBe('connected');
      expect(mockClient.healthCheck).not.toHaveBeenCalled();
    });
  });

  describe('disconnect', () => {
    it('should transition to disconnected', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', message: 'OK', details: {} }),
      } as unknown as KomodoClient;

      await manager.connect(mockClient);
      expect(manager.isConnected()).toBe(true);

      manager.disconnect();

      expect(manager.getState()).toBe('disconnected');
      expect(manager.getClient()).toBeNull();
      expect(manager.isConnected()).toBe(false);
      expect(manager.getLastError()).toBeNull();
    });
  });

  describe('setError', () => {
    it('should transition to error state', () => {
      const error = new Error('Something went wrong');
      manager.setError(error);

      expect(manager.getState()).toBe('error');
      expect(manager.getLastError()).toBe(error);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on state change', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      manager.setConnecting();

      expect(listener).toHaveBeenCalledWith('connecting', null, undefined);
    });

    it('should not notify on same state', async () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      // First transition to connecting
      manager.setConnecting();
      expect(listener).toHaveBeenCalledTimes(1);

      // Try again - should not notify
      manager.setConnecting();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe when cleanup function is called', () => {
      const listener = vi.fn();
      const unsubscribe = manager.onStateChange(listener);

      unsubscribe();
      manager.setConnecting();

      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle listener errors gracefully', () => {
      const badListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      manager.onStateChange(badListener);
      manager.onStateChange(goodListener);

      // Should not throw
      expect(() => manager.setConnecting()).not.toThrow();

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });

    it('should clear all listeners', () => {
      const listener = vi.fn();
      manager.onStateChange(listener);

      manager.clearListeners();
      manager.setConnecting();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('history', () => {
    it('should track state changes', () => {
      manager.setConnecting();
      manager.setError(new Error('test'));
      manager.disconnect();

      const history = manager.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].currentState).toBe('connecting');
      expect(history[1].currentState).toBe('error');
      expect(history[2].currentState).toBe('disconnected');
    });

    it('should limit history size', () => {
      // Make 15 transitions (more than max of 10)
      for (let i = 0; i < 15; i++) {
        if (i % 2 === 0) {
          manager.setConnecting();
        } else {
          manager.disconnect();
        }
      }

      const history = manager.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', async () => {
      const mockClient = {
        healthCheck: vi.fn().mockResolvedValue({ status: 'healthy', message: 'OK', details: {} }),
      } as unknown as KomodoClient;

      await manager.connect(mockClient);
      manager.onStateChange(vi.fn());

      manager.reset();

      expect(manager.getState()).toBe('disconnected');
      expect(manager.getClient()).toBeNull();
      expect(manager.getLastError()).toBeNull();
      expect(manager.getHistory()).toHaveLength(0);
    });
  });
});
