/**
 * Tests for Server Metrics Module
 *
 * Tests the ServerMetricsManager including:
 * - Request recording
 * - Session tracking
 * - Connection state changes
 * - Error recording
 * - Server stats
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ServerMetricsManager } from '../../../../src/server/telemetry/metrics.js';
import { METRIC_ATTRIBUTES } from '../../../../src/server/telemetry/core/index.js';

// Mock OpenTelemetry metrics API
vi.mock('@opentelemetry/api', () => ({
  metrics: {
    getMeter: vi.fn(() => ({
      createCounter: vi.fn(() => ({ add: vi.fn() })),
      createHistogram: vi.fn(() => ({ record: vi.fn() })),
      createUpDownCounter: vi.fn(() => ({ add: vi.fn() })),
      createObservableGauge: vi.fn(() => ({ addCallback: vi.fn() })),
    })),
  },
}));

describe('ServerMetricsManager', () => {
  let metricsManager: ServerMetricsManager;

  beforeEach(() => {
    vi.resetModules();
    metricsManager = new ServerMetricsManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with zero counts', () => {
      const stats = metricsManager.getStats();

      expect(stats.totalRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.activeHttpSessions).toBe(0);
      expect(stats.activeLegacySseSessions).toBe(0);
      expect(stats.connectionStateChanges).toBe(0);
    });

    it('should have a start time', () => {
      const stats = metricsManager.getStats();

      expect(stats.startTime).toBeInstanceOf(Date);
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should track memory usage', () => {
      const stats = metricsManager.getStats();

      expect(stats.memoryUsageBytes).toBeGreaterThan(0);
      expect(stats.heapUsedBytes).toBeGreaterThan(0);
    });
  });

  describe('recordRequest', () => {
    it('should increment total requests on success', () => {
      metricsManager.recordRequest('test_tool', 100, true);

      const stats = metricsManager.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.failedRequests).toBe(0);
    });

    it('should increment failed requests on failure', () => {
      metricsManager.recordRequest('test_tool', 100, false);

      const stats = metricsManager.getStats();
      expect(stats.totalRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
    });

    it('should count multiple requests correctly', () => {
      metricsManager.recordRequest('tool_1', 50, true);
      metricsManager.recordRequest('tool_2', 100, true);
      metricsManager.recordRequest('tool_3', 150, false);

      const stats = metricsManager.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.failedRequests).toBe(1);
    });
  });

  describe('recordSessionChange', () => {
    it('should track HTTP session additions', () => {
      metricsManager.recordSessionChange('http', 1);

      const stats = metricsManager.getStats();
      expect(stats.activeHttpSessions).toBe(1);
    });

    it('should track HTTP session removals', () => {
      metricsManager.recordSessionChange('http', 1);
      metricsManager.recordSessionChange('http', 1);
      metricsManager.recordSessionChange('http', -1);

      const stats = metricsManager.getStats();
      expect(stats.activeHttpSessions).toBe(1);
    });

    it('should track Legacy SSE session additions', () => {
      metricsManager.recordSessionChange('legacy-sse', 1);

      const stats = metricsManager.getStats();
      expect(stats.activeLegacySseSessions).toBe(1);
    });

    it('should track Legacy SSE session removals', () => {
      metricsManager.recordSessionChange('legacy-sse', 1);
      metricsManager.recordSessionChange('legacy-sse', 1);
      metricsManager.recordSessionChange('legacy-sse', -1);

      const stats = metricsManager.getStats();
      expect(stats.activeLegacySseSessions).toBe(1);
    });

    it('should track both transport types independently', () => {
      metricsManager.recordSessionChange('http', 1);
      metricsManager.recordSessionChange('http', 1);
      metricsManager.recordSessionChange('legacy-sse', 1);

      const stats = metricsManager.getStats();
      expect(stats.activeHttpSessions).toBe(2);
      expect(stats.activeLegacySseSessions).toBe(1);
    });

    it('should ignore unknown transport types', () => {
      metricsManager.recordSessionChange('unknown', 1);

      const stats = metricsManager.getStats();
      expect(stats.activeHttpSessions).toBe(0);
      expect(stats.activeLegacySseSessions).toBe(0);
    });
  });

  describe('recordConnectionStateChange', () => {
    it('should increment connection state changes', () => {
      metricsManager.recordConnectionStateChange('disconnected', 'connecting');

      const stats = metricsManager.getStats();
      expect(stats.connectionStateChanges).toBe(1);
    });

    it('should count multiple state changes', () => {
      metricsManager.recordConnectionStateChange('disconnected', 'connecting');
      metricsManager.recordConnectionStateChange('connecting', 'connected');
      metricsManager.recordConnectionStateChange('connected', 'disconnected');

      const stats = metricsManager.getStats();
      expect(stats.connectionStateChanges).toBe(3);
    });
  });

  describe('recordError', () => {
    it('should record errors without affecting other stats', () => {
      // recordError uses OTEL counter, doesn't affect in-memory stats
      // This test ensures no exceptions are thrown
      expect(() => {
        metricsManager.recordError('ValidationError', 'tools');
        metricsManager.recordError('ConnectionError', 'api');
      }).not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return accurate uptime', async () => {
      const beforeStats = metricsManager.getStats();

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const afterStats = metricsManager.getStats();
      expect(afterStats.uptimeMs).toBeGreaterThan(beforeStats.uptimeMs);
    });

    it('should return all stats fields', () => {
      const stats = metricsManager.getStats();

      expect(stats).toHaveProperty('uptimeMs');
      expect(stats).toHaveProperty('startTime');
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('failedRequests');
      expect(stats).toHaveProperty('activeHttpSessions');
      expect(stats).toHaveProperty('activeLegacySseSessions');
      expect(stats).toHaveProperty('connectionStateChanges');
      expect(stats).toHaveProperty('memoryUsageBytes');
      expect(stats).toHaveProperty('heapUsedBytes');
    });
  });

  describe('reset', () => {
    it('should reset all counters to zero', () => {
      // Add some data
      metricsManager.recordRequest('tool', 100, true);
      metricsManager.recordRequest('tool', 100, false);
      metricsManager.recordSessionChange('http', 1);
      metricsManager.recordSessionChange('legacy-sse', 1);
      metricsManager.recordConnectionStateChange('disconnected', 'connected');

      // Reset
      metricsManager.reset();

      const stats = metricsManager.getStats();
      expect(stats.totalRequests).toBe(0);
      expect(stats.failedRequests).toBe(0);
      expect(stats.activeHttpSessions).toBe(0);
      expect(stats.activeLegacySseSessions).toBe(0);
      expect(stats.connectionStateChanges).toBe(0);
    });

    it('should not reset uptime', () => {
      metricsManager.reset();

      const stats = metricsManager.getStats();
      expect(stats.uptimeMs).toBeGreaterThanOrEqual(0);
      expect(stats.startTime).toBeInstanceOf(Date);
    });
  });
});

describe('METRIC_ATTRIBUTES', () => {
  it('should export all expected attribute names', () => {
    expect(METRIC_ATTRIBUTES.TOOL_NAME).toBe('tool.name');
    expect(METRIC_ATTRIBUTES.TRANSPORT).toBe('transport');
    expect(METRIC_ATTRIBUTES.SUCCESS).toBe('success');
    expect(METRIC_ATTRIBUTES.ERROR_TYPE).toBe('error.type');
    expect(METRIC_ATTRIBUTES.COMPONENT).toBe('component');
    expect(METRIC_ATTRIBUTES.PREVIOUS_STATE).toBe('connection.state.previous');
    expect(METRIC_ATTRIBUTES.CURRENT_STATE).toBe('connection.state.current');
  });
});

describe('ServerMetricsManager with telemetry enabled', () => {
  // Store mock functions to verify calls
  const mockCounterAdd = vi.fn();
  const mockHistogramRecord = vi.fn();
  const mockUpDownCounterAdd = vi.fn();
  // Store callbacks for testing
  const observableCallbacks: Array<(result: { observe: (value: number) => void }) => void> = [];

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    observableCallbacks.length = 0;

    // Mock telemetry config to be enabled
    vi.doMock('../../../../src/server/telemetry/core/index.js', () => ({
      getTelemetryConfig: vi.fn(() => ({
        enabled: true,
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
      })),
      TELEMETRY_LOG_COMPONENTS: {
        SDK: 'TelemetrySDK',
        TRACING: 'Tracing',
        METRICS: 'Metrics',
        CONFIG: 'TelemetryConfig',
      },
      METRIC_ATTRIBUTES: {
        TOOL_NAME: 'tool.name',
        TRANSPORT: 'transport',
        SUCCESS: 'success',
        ERROR_TYPE: 'error.type',
        COMPONENT: 'component',
        PREVIOUS_STATE: 'connection.state.previous',
        CURRENT_STATE: 'connection.state.current',
      },
      METRIC_NAMES: {
        REQUESTS_TOTAL: 'mcp.server.requests',
        REQUEST_DURATION: 'mcp.server.request.duration',
        SESSIONS_ACTIVE: 'mcp.server.sessions.active',
        CONNECTION_STATE_CHANGES: 'mcp.server.connection.state_changes',
        ERRORS_TOTAL: 'mcp.server.errors',
        UPTIME: 'mcp.server.uptime',
        MEMORY_HEAP_USED: 'mcp.server.memory.heap_used',
        MEMORY_RSS: 'mcp.server.memory.rss',
      },
      METRIC_DESCRIPTIONS: {
        'mcp.server.requests': 'Total number of MCP requests processed',
        'mcp.server.request.duration': 'Duration of MCP requests in milliseconds',
        'mcp.server.sessions.active': 'Number of active sessions',
        'mcp.server.connection.state_changes': 'Number of connection state changes',
        'mcp.server.errors': 'Total number of errors',
        'mcp.server.uptime': 'Server uptime in seconds',
        'mcp.server.memory.heap_used': 'Heap memory used in bytes',
        'mcp.server.memory.rss': 'Resident set size in bytes',
      },
      METRIC_UNITS: {
        COUNT: '1',
        MILLISECONDS: 'ms',
        SECONDS: 's',
        BYTES: 'By',
      },
      TRANSPORT_TYPES: {
        HTTP: 'http',
        LEGACY_SSE: 'legacy-sse',
        STDIO: 'stdio',
      },
    }));

    // Mock OpenTelemetry with trackable mocks
    vi.doMock('@opentelemetry/api', () => ({
      metrics: {
        getMeter: vi.fn(() => ({
          createCounter: vi.fn(() => ({ add: mockCounterAdd })),
          createHistogram: vi.fn(() => ({ record: mockHistogramRecord })),
          createUpDownCounter: vi.fn(() => ({ add: mockUpDownCounterAdd })),
          createObservableGauge: vi.fn(() => ({
            addCallback: vi.fn((cb: (result: { observe: (value: number) => void }) => void) => {
              observableCallbacks.push(cb);
            }),
          })),
        })),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call OpenTelemetry counter on recordRequest', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    manager.recordRequest('test-tool', 100, true);

    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      'tool.name': 'test-tool',
      success: 'true',
    });
    expect(mockHistogramRecord).toHaveBeenCalledWith(100, {
      'tool.name': 'test-tool',
      success: 'true',
    });
  });

  it('should call OpenTelemetry counter on recordRequest with failure', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    manager.recordRequest('failing-tool', 200, false);

    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      'tool.name': 'failing-tool',
      success: 'false',
    });
  });

  it('should call OpenTelemetry updown counter on recordSessionChange', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    manager.recordSessionChange('http', 1);

    expect(mockUpDownCounterAdd).toHaveBeenCalledWith(1, {
      transport: 'http',
    });
  });

  it('should call OpenTelemetry counter on recordConnectionStateChange', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    manager.recordConnectionStateChange('disconnected', 'connecting');

    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      'connection.state.previous': 'disconnected',
      'connection.state.current': 'connecting',
    });
  });

  it('should call OpenTelemetry counter on recordError', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    manager.recordError('ValidationError', 'tools');

    expect(mockCounterAdd).toHaveBeenCalledWith(1, {
      'error.type': 'ValidationError',
      component: 'tools',
    });
  });

  it('should register observable gauge callbacks', async () => {
    await import('../../../../src/server/telemetry/metrics.js');

    // Observable gauges are created during initialization
    // We should have 3 callbacks registered (uptime, heap_used, rss)
    expect(observableCallbacks).toHaveLength(3);
  });

  it('should execute uptime callback correctly', async () => {
    await import('../../../../src/server/telemetry/metrics.js');

    // First callback is uptime
    const uptimeCallback = observableCallbacks[0];
    const mockObserve = vi.fn();

    uptimeCallback({ observe: mockObserve });

    expect(mockObserve).toHaveBeenCalledTimes(1);
    // Uptime should be a positive number (in seconds)
    expect(mockObserve.mock.calls[0][0]).toBeGreaterThanOrEqual(0);
  });

  it('should execute heap_used callback correctly', async () => {
    await import('../../../../src/server/telemetry/metrics.js');

    // Second callback is heap_used
    const heapCallback = observableCallbacks[1];
    const mockObserve = vi.fn();

    heapCallback({ observe: mockObserve });

    expect(mockObserve).toHaveBeenCalledTimes(1);
    // Heap used should be a positive number (in bytes)
    expect(mockObserve.mock.calls[0][0]).toBeGreaterThan(0);
  });

  it('should execute rss callback correctly', async () => {
    await import('../../../../src/server/telemetry/metrics.js');

    // Third callback is rss
    const rssCallback = observableCallbacks[2];
    const mockObserve = vi.fn();

    rssCallback({ observe: mockObserve });

    expect(mockObserve).toHaveBeenCalledTimes(1);
    // RSS should be a positive number (in bytes)
    expect(mockObserve.mock.calls[0][0]).toBeGreaterThan(0);
  });
});

describe('ServerMetricsManager with telemetry disabled', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Mock telemetry config to be disabled
    vi.doMock('../../../../src/server/telemetry/core/index.js', () => ({
      getTelemetryConfig: vi.fn(() => ({
        enabled: false,
        serviceName: 'test-service',
        serviceVersion: '1.0.0',
      })),
      TELEMETRY_LOG_COMPONENTS: {
        SDK: 'TelemetrySDK',
        TRACING: 'Tracing',
        METRICS: 'Metrics',
        CONFIG: 'TelemetryConfig',
      },
      METRIC_ATTRIBUTES: {
        TOOL_NAME: 'tool.name',
        TRANSPORT: 'transport',
        SUCCESS: 'success',
        ERROR_TYPE: 'error.type',
        COMPONENT: 'component',
        PREVIOUS_STATE: 'connection.state.previous',
        CURRENT_STATE: 'connection.state.current',
      },
      METRIC_NAMES: {
        REQUESTS_TOTAL: 'mcp.server.requests',
        REQUEST_DURATION: 'mcp.server.request.duration',
        SESSIONS_ACTIVE: 'mcp.server.sessions.active',
        CONNECTION_STATE_CHANGES: 'mcp.server.connection.state_changes',
        ERRORS_TOTAL: 'mcp.server.errors',
        UPTIME: 'mcp.server.uptime',
        MEMORY_HEAP_USED: 'mcp.server.memory.heap_used',
        MEMORY_RSS: 'mcp.server.memory.rss',
      },
      METRIC_DESCRIPTIONS: {
        'mcp.server.requests': 'Total number of MCP requests processed',
        'mcp.server.request.duration': 'Duration of MCP requests in milliseconds',
        'mcp.server.sessions.active': 'Number of active sessions',
        'mcp.server.connection.state_changes': 'Number of connection state changes',
        'mcp.server.errors': 'Total number of errors',
        'mcp.server.uptime': 'Server uptime in seconds',
        'mcp.server.memory.heap_used': 'Heap memory used in bytes',
        'mcp.server.memory.rss': 'Resident set size in bytes',
      },
      METRIC_UNITS: {
        COUNT: '1',
        MILLISECONDS: 'ms',
        SECONDS: 's',
        BYTES: 'By',
      },
      TRANSPORT_TYPES: {
        HTTP: 'http',
        LEGACY_SSE: 'legacy-sse',
        STDIO: 'stdio',
      },
    }));

    // Mock OpenTelemetry - should NOT be called
    vi.doMock('@opentelemetry/api', () => ({
      metrics: {
        getMeter: vi.fn(() => {
          throw new Error('getMeter should not be called when telemetry is disabled');
        }),
      },
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should not initialize OpenTelemetry when disabled', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');

    // Should not throw - getMeter should not be called
    expect(() => new ServerMetricsManager()).not.toThrow();
  });

  it('should still track in-memory stats when telemetry disabled', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    manager.recordRequest('test', 100, true);
    manager.recordSessionChange('http', 1);
    manager.recordConnectionStateChange('disconnected', 'connected');

    const stats = manager.getStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.activeHttpSessions).toBe(1);
    expect(stats.connectionStateChanges).toBe(1);
  });

  it('should handle recordError gracefully when telemetry disabled', async () => {
    const { ServerMetricsManager } = await import('../../../../src/server/telemetry/metrics.js');
    const manager = new ServerMetricsManager();

    // Should not throw even without OTEL instruments
    expect(() => manager.recordError('TestError', 'test')).not.toThrow();
  });
});
