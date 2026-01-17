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
 * @module server/telemetry/metrics
 */

import { metrics } from '@opentelemetry/api';
import type { Counter, Histogram, UpDownCounter, Attributes } from '@opentelemetry/api';
import {
  getTelemetryConfig,
  METRIC_ATTRIBUTES,
  METRIC_NAMES,
  METRIC_DESCRIPTIONS,
  METRIC_UNITS,
  TRANSPORT_TYPES,
  TELEMETRY_LOG_COMPONENTS,
  type ServerMetrics,
  type ServerStats,
} from './core/index.js';
import { logger as baseLogger } from '../logger/index.js';

const logger = baseLogger.child({ component: TELEMETRY_LOG_COMPONENTS.METRICS });

/**
 * Internal structure for metric instruments.
 * @internal
 */
interface MetricInstruments {
  requestCounter?: Counter;
  requestDuration?: Histogram;
  sessionGauge?: UpDownCounter;
  connectionStateCounter?: Counter;
  errorCounter?: Counter;
}

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
  private instruments: MetricInstruments = {};

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
    this.instruments.requestCounter = meter.createCounter(METRIC_NAMES.REQUESTS_TOTAL, {
      description: METRIC_DESCRIPTIONS[METRIC_NAMES.REQUESTS_TOTAL],
      unit: METRIC_UNITS.COUNT,
    });

    // Request duration histogram
    this.instruments.requestDuration = meter.createHistogram(METRIC_NAMES.REQUEST_DURATION, {
      description: METRIC_DESCRIPTIONS[METRIC_NAMES.REQUEST_DURATION],
      unit: METRIC_UNITS.MILLISECONDS,
    });

    // Session gauge (up/down counter for active sessions)
    this.instruments.sessionGauge = meter.createUpDownCounter(METRIC_NAMES.SESSIONS_ACTIVE, {
      description: METRIC_DESCRIPTIONS[METRIC_NAMES.SESSIONS_ACTIVE],
      unit: METRIC_UNITS.COUNT,
    });

    // Connection state change counter
    this.instruments.connectionStateCounter = meter.createCounter(METRIC_NAMES.CONNECTION_STATE_CHANGES, {
      description: METRIC_DESCRIPTIONS[METRIC_NAMES.CONNECTION_STATE_CHANGES],
      unit: METRIC_UNITS.COUNT,
    });

    // Error counter
    this.instruments.errorCounter = meter.createCounter(METRIC_NAMES.ERRORS_TOTAL, {
      description: METRIC_DESCRIPTIONS[METRIC_NAMES.ERRORS_TOTAL],
      unit: METRIC_UNITS.COUNT,
    });

    // Observable gauges for system metrics
    meter
      .createObservableGauge(METRIC_NAMES.UPTIME, {
        description: METRIC_DESCRIPTIONS[METRIC_NAMES.UPTIME],
        unit: METRIC_UNITS.SECONDS,
      })
      .addCallback((result) => {
        const uptimeSeconds = (Date.now() - this.startTime.getTime()) / 1000;
        result.observe(uptimeSeconds);
      });

    meter
      .createObservableGauge(METRIC_NAMES.MEMORY_HEAP_USED, {
        description: METRIC_DESCRIPTIONS[METRIC_NAMES.MEMORY_HEAP_USED],
        unit: METRIC_UNITS.BYTES,
      })
      .addCallback((result) => {
        const memUsage = process.memoryUsage();
        result.observe(memUsage.heapUsed);
      });

    meter
      .createObservableGauge(METRIC_NAMES.MEMORY_RSS, {
        description: METRIC_DESCRIPTIONS[METRIC_NAMES.MEMORY_RSS],
        unit: METRIC_UNITS.BYTES,
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

    try {
      const attributes: Attributes = {
        [METRIC_ATTRIBUTES.TOOL_NAME]: toolName,
        [METRIC_ATTRIBUTES.SUCCESS]: String(success),
      };

      this.instruments.requestCounter?.add(1, attributes);
      this.instruments.requestDuration?.record(durationMs, attributes);
    } catch (error) {
      /* v8 ignore next 3 - OTEL error handling */
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to record request metric: ${message}`);
    }
  }

  /**
   * Record an active session change.
   * @param transport - Transport type ('http' or 'legacy-sse')
   * @param delta - Change in session count (+1 for new, -1 for closed)
   */
  recordSessionChange(transport: string, delta: number): void {
    if (transport === TRANSPORT_TYPES.HTTP) {
      this.activeHttpSessions += delta;
    } else if (transport === TRANSPORT_TYPES.LEGACY_SSE) {
      this.activeLegacySseSessions += delta;
    }

    try {
      this.instruments.sessionGauge?.add(delta, {
        [METRIC_ATTRIBUTES.TRANSPORT]: transport,
      });
    } catch (error) {
      /* v8 ignore next 3 - OTEL error handling */
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to record session metric: ${message}`);
    }
  }

  /**
   * Record a connection state change.
   */
  recordConnectionStateChange(previousState: string, newState: string): void {
    this.connectionStateChanges++;

    try {
      this.instruments.connectionStateCounter?.add(1, {
        [METRIC_ATTRIBUTES.PREVIOUS_STATE]: previousState,
        [METRIC_ATTRIBUTES.CURRENT_STATE]: newState,
      });
    } catch (error) {
      /* v8 ignore next 3 - OTEL error handling */
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to record connection state metric: ${message}`);
    }
  }

  /**
   * Record an error.
   */
  recordError(errorType: string, component: string): void {
    try {
      this.instruments.errorCounter?.add(1, {
        [METRIC_ATTRIBUTES.ERROR_TYPE]: errorType,
        [METRIC_ATTRIBUTES.COMPONENT]: component,
      });
    } catch (error) {
      /* v8 ignore next 3 - OTEL error handling */
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(`Failed to record error metric: ${message}`);
    }
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

// ============================================================================
// Factory & Singleton
// ============================================================================

/** Singleton instance - lazily initialized */
let instance: ServerMetricsManager | null = null;

/**
 * Create a new ServerMetricsManager instance.
 *
 * Use this factory function for testing or when you need
 * an independent metrics instance.
 *
 * @returns A new ServerMetricsManager instance
 *
 * @example
 * ```typescript
 * // For testing - create isolated instance
 * const metrics = createServerMetrics();
 * metrics.recordRequest('test-tool', 100, true);
 * ```
 */
export function createServerMetrics(): ServerMetricsManager {
  return new ServerMetricsManager();
}

/**
 * Get the singleton ServerMetricsManager instance.
 *
 * This is the recommended way to access metrics in production code.
 * The instance is lazily initialized on first access.
 *
 * @returns The singleton ServerMetricsManager instance
 *
 * @example
 * ```typescript
 * import { getServerMetrics } from './telemetry/metrics.js';
 *
 * const metrics = getServerMetrics();
 * metrics.recordRequest('tool_name', 150, true);
 * ```
 */
export function getServerMetrics(): ServerMetricsManager {
  if (!instance) {
    instance = new ServerMetricsManager();
  }
  return instance;
}

/**
 * Reset the singleton instance.
 *
 * **Warning**: Only use this for testing purposes.
 * This will reset all tracked metrics and create a fresh instance.
 *
 * @internal
 */
export function resetServerMetrics(): void {
  if (instance) {
    instance.reset();
  }
  instance = null;
}

/**
 * Singleton instance of the ServerMetricsManager.
 *
 * @deprecated Use `getServerMetrics()` instead for lazy initialization.
 * This export is maintained for backward compatibility.
 */
export const serverMetrics = getServerMetrics();

// Export the class for testing
export { ServerMetricsManager };
