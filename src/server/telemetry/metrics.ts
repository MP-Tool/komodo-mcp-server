/**
 * OpenTelemetry Metrics for Server State
 *
 * Provides metrics collection for the Komodo MCP Server including:
 * - Server uptime and startup time
 * - Active sessions and connections
 * - Request counts and latencies
 * - Memory and resource usage
 * - Connection state transitions
 *
 * @module telemetry/metrics
 */

import { metrics, Counter, Histogram, UpDownCounter, Attributes } from '@opentelemetry/api';
import { getTelemetryConfig } from './config.js';

/**
 * Server metrics interface for type-safe metric recording.
 */
export interface ServerMetrics {
  /** Record a request (tool invocation) */
  recordRequest(toolName: string, durationMs: number, success: boolean): void;
  /** Record an active session change */
  recordSessionChange(transport: string, delta: number): void;
  /** Record a connection state change */
  recordConnectionStateChange(previousState: string, newState: string): void;
  /** Record an error */
  recordError(errorType: string, component: string): void;
  /** Get current server stats */
  getStats(): ServerStats;
}

/**
 * Server statistics snapshot.
 */
export interface ServerStats {
  /** Server uptime in milliseconds */
  uptimeMs: number;
  /** Server start time */
  startTime: Date;
  /** Total requests processed */
  totalRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Active HTTP sessions */
  activeHttpSessions: number;
  /** Active Legacy SSE sessions */
  activeLegacySseSessions: number;
  /** Connection state changes count */
  connectionStateChanges: number;
  /** Current memory usage in bytes */
  memoryUsageBytes: number;
  /** Current heap used in bytes */
  heapUsedBytes: number;
}

/**
 * Semantic attribute names for server metrics.
 */
export const METRIC_ATTRIBUTES = {
  /** Tool name being invoked */
  TOOL_NAME: 'tool.name',
  /** Transport type (http, sse, stdio) */
  TRANSPORT: 'transport',
  /** Request success status */
  SUCCESS: 'success',
  /** Error type */
  ERROR_TYPE: 'error.type',
  /** Component where error occurred */
  COMPONENT: 'component',
  /** Previous connection state */
  PREVIOUS_STATE: 'connection.state.previous',
  /** Current connection state */
  CURRENT_STATE: 'connection.state.current',
} as const;

/**
 * Server Metrics Manager
 *
 * Collects and exports metrics about server state and performance.
 * Uses OpenTelemetry metrics API when available, falls back to in-memory tracking.
 */
class ServerMetricsManager implements ServerMetrics {
  private readonly startTime: Date;
  private totalRequests = 0;
  private failedRequests = 0;
  private activeHttpSessions = 0;
  private activeLegacySseSessions = 0;
  private connectionStateChanges = 0;

  // OpenTelemetry instruments
  private requestCounter?: Counter;
  private requestDuration?: Histogram;
  private sessionGauge?: UpDownCounter;
  private connectionStateCounter?: Counter;
  private errorCounter?: Counter;

  constructor() {
    this.startTime = new Date();
    this.initializeMetrics();
  }

  /**
   * Initialize OpenTelemetry metrics instruments.
   */
  private initializeMetrics(): void {
    const config = getTelemetryConfig();

    if (!config.enabled) {
      return; // Skip OTEL setup if disabled
    }

    const meter = metrics.getMeter(config.serviceName, config.serviceVersion);

    // Request counter
    this.requestCounter = meter.createCounter('mcp.server.requests', {
      description: 'Total number of MCP requests processed',
      unit: '1',
    });

    // Request duration histogram
    this.requestDuration = meter.createHistogram('mcp.server.request.duration', {
      description: 'Duration of MCP requests in milliseconds',
      unit: 'ms',
    });

    // Session gauge (up/down counter for active sessions)
    this.sessionGauge = meter.createUpDownCounter('mcp.server.sessions.active', {
      description: 'Number of active sessions',
      unit: '1',
    });

    // Connection state change counter
    this.connectionStateCounter = meter.createCounter('mcp.server.connection.state_changes', {
      description: 'Number of connection state changes',
      unit: '1',
    });

    // Error counter
    this.errorCounter = meter.createCounter('mcp.server.errors', {
      description: 'Total number of errors',
      unit: '1',
    });

    // Observable gauges for system metrics
    meter
      .createObservableGauge('mcp.server.uptime', {
        description: 'Server uptime in seconds',
        unit: 's',
      })
      .addCallback((result) => {
        const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;
        result.observe(uptimeSeconds);
      });

    meter
      .createObservableGauge('mcp.server.memory.heap_used', {
        description: 'Heap memory used in bytes',
        unit: 'By',
      })
      .addCallback((result) => {
        const memUsage = process.memoryUsage();
        result.observe(memUsage.heapUsed);
      });

    meter
      .createObservableGauge('mcp.server.memory.rss', {
        description: 'Resident set size in bytes',
        unit: 'By',
      })
      .addCallback((result) => {
        const memUsage = process.memoryUsage();
        result.observe(memUsage.rss);
      });
  }

  /**
   * Record a request (tool invocation).
   */
  recordRequest(toolName: string, durationMs: number, success: boolean): void {
    this.totalRequests++;
    if (!success) {
      this.failedRequests++;
    }

    const attributes: Attributes = {
      [METRIC_ATTRIBUTES.TOOL_NAME]: toolName,
      [METRIC_ATTRIBUTES.SUCCESS]: String(success),
    };

    this.requestCounter?.add(1, attributes);
    this.requestDuration?.record(durationMs, attributes);
  }

  /**
   * Record an active session change.
   * @param transport - Transport type ('http' or 'legacy-sse')
   * @param delta - Change in session count (+1 for new, -1 for closed)
   */
  recordSessionChange(transport: string, delta: number): void {
    if (transport === 'http') {
      this.activeHttpSessions += delta;
    } else if (transport === 'legacy-sse') {
      this.activeLegacySseSessions += delta;
    }

    this.sessionGauge?.add(delta, {
      [METRIC_ATTRIBUTES.TRANSPORT]: transport,
    });
  }

  /**
   * Record a connection state change.
   */
  recordConnectionStateChange(previousState: string, newState: string): void {
    this.connectionStateChanges++;

    this.connectionStateCounter?.add(1, {
      [METRIC_ATTRIBUTES.PREVIOUS_STATE]: previousState,
      [METRIC_ATTRIBUTES.CURRENT_STATE]: newState,
    });
  }

  /**
   * Record an error.
   */
  recordError(errorType: string, component: string): void {
    this.errorCounter?.add(1, {
      [METRIC_ATTRIBUTES.ERROR_TYPE]: errorType,
      [METRIC_ATTRIBUTES.COMPONENT]: component,
    });
  }

  /**
   * Get current server statistics.
   */
  getStats(): ServerStats {
    const memUsage = process.memoryUsage();

    return {
      uptimeMs: Date.now() - this.startTime.getTime(),
      startTime: this.startTime,
      totalRequests: this.totalRequests,
      failedRequests: this.failedRequests,
      activeHttpSessions: this.activeHttpSessions,
      activeLegacySseSessions: this.activeLegacySseSessions,
      connectionStateChanges: this.connectionStateChanges,
      memoryUsageBytes: memUsage.rss,
      heapUsedBytes: memUsage.heapUsed,
    };
  }

  /**
   * Reset all statistics.
   * Useful for testing.
   */
  reset(): void {
    this.totalRequests = 0;
    this.failedRequests = 0;
    this.activeHttpSessions = 0;
    this.activeLegacySseSessions = 0;
    this.connectionStateChanges = 0;
  }
}

/**
 * Singleton instance of the ServerMetricsManager.
 */
export const serverMetrics = new ServerMetricsManager();

// Export the class for testing
export { ServerMetricsManager };
