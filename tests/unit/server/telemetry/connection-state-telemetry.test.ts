/**
 * Tests for Connection State Manager with Telemetry Integration
 *
 * Tests the telemetry features in ConnectionStateManager including:
 * - Span creation during connect
 * - Span attributes and events
 * - Metrics recording
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock telemetry modules - must be before imports
vi.mock('../../../../src/server/telemetry/index.js', () => {
  const mockSpan = {
    setAttribute: vi.fn(),
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
  };

  return {
    withSpan: vi.fn().mockImplementation(async (_name: string, fn: (span: typeof mockSpan) => Promise<unknown>) => {
      return fn(mockSpan);
    }),
    addSpanAttributes: vi.fn(),
    addSpanEvent: vi.fn(),
    MCP_ATTRIBUTES: {
      OPERATION: 'mcp.operation',
      ERROR: 'mcp.error',
    },
    // Export mockSpan for tests to access via getMockSpan
    _getMockSpan: () => mockSpan,
  };
});

vi.mock('../../../../src/server/telemetry/metrics.js', () => ({
  serverMetrics: {
    recordConnectionStateChange: vi.fn(),
    recordRequest: vi.fn(),
    recordSessionChange: vi.fn(),
    recordError: vi.fn(),
    getStats: vi.fn(() => ({
      totalRequests: 0,
      failedRequests: 0,
      activeHttpSessions: 0,
      activeLegacySseSessions: 0,
      connectionStateChanges: 0,
      uptimeMs: 0,
      memoryUsageBytes: 0,
      heapUsedBytes: 0,
      startTime: new Date(),
    })),
    reset: vi.fn(),
  },
}));

// Mock logger
vi.mock('../../../../src/utils/logger/logger.js', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Import after mocks
import { ConnectionStateManager } from '../../../../src/server/connection/connection-state.js';
import * as telemetryModule from '../../../../src/server/telemetry/index.js';
import { serverMetrics } from '../../../../src/server/telemetry/metrics.js';
import type { KomodoClient } from '../../../../src/api/index.js';

// Get mocked functions
const mockedWithSpan = vi.mocked(telemetryModule.withSpan);
const mockedAddSpanAttributes = vi.mocked(telemetryModule.addSpanAttributes);
const mockedAddSpanEvent = vi.mocked(telemetryModule.addSpanEvent);
const mockedRecordConnectionStateChange = vi.mocked(serverMetrics.recordConnectionStateChange);

// Get mock span from the module
const getMockSpan = (
  telemetryModule as unknown as {
    _getMockSpan: () => {
      setAttribute: ReturnType<typeof vi.fn>;
      setStatus: ReturnType<typeof vi.fn>;
      recordException: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
    };
  }
)._getMockSpan;

describe('ConnectionStateManager Telemetry', () => {
  let connectionManager: ConnectionStateManager;
  let mockClient: KomodoClient;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock KomodoClient
    mockClient = {
      healthCheck: vi.fn().mockResolvedValue({
        status: 'healthy',
        details: {
          url: 'http://localhost:9120',
          apiVersion: '1.0.0',
        },
      }),
      getVersion: vi.fn().mockResolvedValue({ version: '1.0.0' }),
    } as unknown as KomodoClient;

    connectionManager = new ConnectionStateManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect with telemetry', () => {
    it('should create a span for connection', async () => {
      await connectionManager.connect(mockClient);

      expect(mockedWithSpan).toHaveBeenCalled();
      expect(mockedWithSpan).toHaveBeenCalledWith('komodo.connection.connect', expect.any(Function));
    });

    it('should add span attributes for connection config', async () => {
      await connectionManager.connect(mockClient);

      expect(mockedAddSpanAttributes).toHaveBeenCalledWith(
        expect.objectContaining({
          'mcp.operation': 'connect',
          'connection.skip_health_check': false,
        }),
      );
    });

    it('should add span events for health check', async () => {
      await connectionManager.connect(mockClient);

      // Check that health_check.start event was added
      expect(mockedAddSpanEvent).toHaveBeenCalledWith('health_check.start');

      // Check that health_check.success event was added
      expect(mockedAddSpanEvent).toHaveBeenCalledWith(
        'health_check.success',
        expect.objectContaining({
          'health.url': 'http://localhost:9120',
          'health.api_version': '1.0.0',
        }),
      );

      // Check that connection.established event was added
      expect(mockedAddSpanEvent).toHaveBeenCalledWith('connection.established');
    });

    it('should skip health check events when skipHealthCheck is true', async () => {
      await connectionManager.connect(mockClient, true);

      // health_check events should not be called
      expect(mockedAddSpanEvent).not.toHaveBeenCalledWith('health_check.start');
      expect(mockedAddSpanEvent).not.toHaveBeenCalledWith('health_check.success', expect.anything());

      // But connection.established should still be called
      expect(mockedAddSpanEvent).toHaveBeenCalledWith('connection.established');
    });

    it('should set error on span when health check fails', async () => {
      mockClient.healthCheck = vi.fn().mockResolvedValue({
        status: 'unhealthy',
        message: 'Connection refused',
      });

      await connectionManager.connect(mockClient);

      // Check that health_check.failed event was added
      expect(mockedAddSpanEvent).toHaveBeenCalledWith(
        'health_check.failed',
        expect.objectContaining({
          'health.message': 'Connection refused',
        }),
      );

      // Check that error was set on span
      const mockSpan = getMockSpan();
      expect(mockSpan.setAttribute).toHaveBeenCalledWith(
        'error.message',
        expect.stringContaining('Health check failed'),
      );
    });

    it('should set error on span when connection throws', async () => {
      mockClient.healthCheck = vi.fn().mockRejectedValue(new Error('Network error'));

      await connectionManager.connect(mockClient);

      // Check that error was set on span
      const mockSpan = getMockSpan();
      expect(mockSpan.setAttribute).toHaveBeenCalledWith('error.message', 'Network error');
    });
  });

  describe('state change telemetry', () => {
    it('should record state changes in metrics', async () => {
      await connectionManager.connect(mockClient);

      // Should have recorded state changes: disconnected -> connecting -> connected
      expect(mockedRecordConnectionStateChange).toHaveBeenCalledWith('disconnected', 'connecting');
      expect(mockedRecordConnectionStateChange).toHaveBeenCalledWith('connecting', 'connected');
    });

    it('should record error state in metrics', async () => {
      mockClient.healthCheck = vi.fn().mockRejectedValue(new Error('Failed'));

      await connectionManager.connect(mockClient);

      // Should have recorded state changes: disconnected -> connecting -> error
      expect(mockedRecordConnectionStateChange).toHaveBeenCalledWith('disconnected', 'connecting');
      expect(mockedRecordConnectionStateChange).toHaveBeenCalledWith('connecting', 'error');
    });

    it('should record disconnect state in metrics', async () => {
      await connectionManager.connect(mockClient);
      vi.clearAllMocks();

      connectionManager.disconnect();

      expect(mockedRecordConnectionStateChange).toHaveBeenCalledWith('connected', 'disconnected');
    });
  });

  describe('disconnect telemetry', () => {
    it('should add span event for disconnect', async () => {
      await connectionManager.connect(mockClient);
      vi.clearAllMocks();

      connectionManager.disconnect();

      expect(mockedAddSpanEvent).toHaveBeenCalledWith('connection.disconnect');
    });
  });

  describe('state management', () => {
    it('should update state correctly on successful connect', async () => {
      expect(connectionManager.getState()).toBe('disconnected');

      await connectionManager.connect(mockClient);

      expect(connectionManager.getState()).toBe('connected');
      expect(connectionManager.isConnected()).toBe(true);
    });

    it('should update state correctly on failed connect', async () => {
      mockClient.healthCheck = vi.fn().mockRejectedValue(new Error('Failed'));

      expect(connectionManager.getState()).toBe('disconnected');

      await connectionManager.connect(mockClient);

      expect(connectionManager.getState()).toBe('error');
      expect(connectionManager.isConnected()).toBe(false);
    });

    it('should update state correctly on disconnect', async () => {
      await connectionManager.connect(mockClient);
      expect(connectionManager.getState()).toBe('connected');

      connectionManager.disconnect();

      expect(connectionManager.getState()).toBe('disconnected');
      expect(connectionManager.isConnected()).toBe(false);
    });
  });
});
