/**
 * Session Metrics Module
 *
 * Provides metrics collection for session management using OpenTelemetry.
 * Tracks session lifecycle, performance, and health metrics.
 *
 * ## Metrics Collected
 * - `mcp.session.total` - Total sessions created (counter)
 * - `mcp.session.active` - Currently active sessions (gauge)
 * - `mcp.session.duration` - Session duration histogram
 * - `mcp.session.expired` - Expired sessions counter
 * - `mcp.session.heartbeat.success` - Successful heartbeats
 * - `mcp.session.heartbeat.failure` - Failed heartbeats
 *
 * @module session/core/metrics
 */

import { metrics, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

// ============================================================================
// Metric Names
// ============================================================================

/**
 * Session metric names following OpenTelemetry semantic conventions.
 */
export const SESSION_METRIC_NAMES = {
  /** Total sessions created */
  SESSIONS_TOTAL: 'mcp.session.total',

  /** Active sessions gauge */
  SESSIONS_ACTIVE: 'mcp.session.active',

  /** Session duration histogram */
  SESSION_DURATION: 'mcp.session.duration',

  /** Expired sessions counter */
  SESSIONS_EXPIRED: 'mcp.session.expired',

  /** Removed sessions counter */
  SESSIONS_REMOVED: 'mcp.session.removed',

  /** Successful heartbeats */
  HEARTBEAT_SUCCESS: 'mcp.session.heartbeat.success',

  /** Failed heartbeats */
  HEARTBEAT_FAILURE: 'mcp.session.heartbeat.failure',

  /** Session limit reached events */
  LIMIT_REACHED: 'mcp.session.limit_reached',

  /** Cleanup cycles run */
  CLEANUP_CYCLES: 'mcp.session.cleanup.cycles',

  /** Sessions cleaned per cycle */
  CLEANUP_SESSIONS: 'mcp.session.cleanup.sessions',
} as const;

/**
 * Session metric attribute names.
 */
export const SESSION_METRIC_ATTRIBUTES = {
  /** Reason for session close */
  CLOSE_REASON: 'session.close.reason',

  /** Transport type (streamable-http, sse, stdio) */
  TRANSPORT_TYPE: 'session.transport.type',

  /** Manager instance ID */
  MANAGER_ID: 'session.manager.id',
} as const;

// ============================================================================
// Session Metrics Collector
// ============================================================================

/**
 * Session metrics interface for type-safe metric recording.
 */
export interface SessionMetricsCollector {
  /** Record a new session creation */
  recordSessionCreated(transportType?: string): void;

  /** Record a session closure */
  recordSessionClosed(reason: string, durationMs: number): void;

  /** Record a session expiration */
  recordSessionExpired(durationMs: number): void;

  /** Record a session removal */
  recordSessionRemoved(): void;

  /** Record a successful heartbeat */
  recordHeartbeatSuccess(): void;

  /** Record multiple successful heartbeats (batch) */
  recordHeartbeatSuccesses(count: number): void;

  /** Record a failed heartbeat */
  recordHeartbeatFailure(): void;

  /** Record multiple failed heartbeats (batch) */
  recordHeartbeatFailures(count: number): void;

  /** Record session limit reached */
  recordLimitReached(): void;

  /** Record a cleanup cycle */
  recordCleanupCycle(removedCount: number, extendedCount: number): void;

  /** Update active session count */
  updateActiveSessionCount(delta: number): void;

  /** Get current in-memory metrics */
  getMetricsSnapshot(): DetailedSessionMetrics;
}

/**
 * Detailed in-memory metrics snapshot with internal tracking data.
 *
 * For a simplified view suitable for events, see SessionMetricsSnapshot in events.ts.
 */
export interface DetailedSessionMetrics {
  /** Total sessions created */
  totalCreated: number;

  /** Total sessions expired */
  totalExpired: number;

  /** Total sessions removed */
  totalRemoved: number;

  /** Total heartbeat successes */
  totalHeartbeatSuccess: number;

  /** Total heartbeat failures */
  totalHeartbeatFailures: number;

  /** Times limit was reached */
  limitReachedCount: number;

  /** Total cleanup cycles */
  cleanupCycles: number;

  /** Sessions cleaned in total */
  sessionsCleanedTotal: number;

  /** Peak concurrent sessions */
  peakConcurrentSessions: number;

  /** Current active sessions */
  currentActiveSessions: number;

  /** Total session duration (for average calculation) */
  totalDurationMs: number;

  /** Metrics collection start time */
  startTime: Date;
}

// ============================================================================
// Session Metrics Manager Implementation
// ============================================================================

/**
 * Session Metrics Manager Implementation
 *
 * Collects and exports metrics about session state and performance.
 * Uses OpenTelemetry metrics API when available, always tracks in-memory.
 *
 * @internal Use factory functions instead of instantiating directly.
 */
class SessionMetricsManagerImpl implements SessionMetricsCollector {
  // In-memory tracking (always available)
  private totalCreated = 0;
  private totalExpired = 0;
  private totalRemoved = 0;
  private totalHeartbeatSuccess = 0;
  private totalHeartbeatFailures = 0;
  private limitReachedCount = 0;
  private cleanupCycles = 0;
  private sessionsCleanedTotal = 0;
  private peakConcurrentSessions = 0;
  private currentActiveSessions = 0;
  private totalDurationMs = 0;
  private readonly startTime: Date;

  // OpenTelemetry instruments (optional)
  private sessionsTotal?: Counter;
  private sessionsActive?: UpDownCounter;
  private sessionDuration?: Histogram;
  private sessionsExpired?: Counter;
  private sessionsRemoved?: Counter;
  private heartbeatSuccess?: Counter;
  private heartbeatFailure?: Counter;
  private limitReached?: Counter;
  private cleanupCyclesCounter?: Counter;
  private cleanupSessionsCounter?: Counter;

  private initialized = false;

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Initialize OpenTelemetry metrics instruments.
   * Called lazily to allow configuration to be set first.
   */
  initialize(serviceName: string = 'komodo-mcp-server', serviceVersion: string = '1.0.0'): void {
    if (this.initialized) {
      return;
    }

    try {
      const meter = metrics.getMeter(serviceName, serviceVersion);

      // Sessions total counter
      this.sessionsTotal = meter.createCounter(SESSION_METRIC_NAMES.SESSIONS_TOTAL, {
        description: 'Total number of sessions created',
        unit: '1',
      });

      // Active sessions gauge
      this.sessionsActive = meter.createUpDownCounter(SESSION_METRIC_NAMES.SESSIONS_ACTIVE, {
        description: 'Number of currently active sessions',
        unit: '1',
      });

      // Session duration histogram
      this.sessionDuration = meter.createHistogram(SESSION_METRIC_NAMES.SESSION_DURATION, {
        description: 'Session duration in milliseconds',
        unit: 'ms',
      });

      // Expired sessions counter
      this.sessionsExpired = meter.createCounter(SESSION_METRIC_NAMES.SESSIONS_EXPIRED, {
        description: 'Total sessions expired due to timeout',
        unit: '1',
      });

      // Removed sessions counter
      this.sessionsRemoved = meter.createCounter(SESSION_METRIC_NAMES.SESSIONS_REMOVED, {
        description: 'Total sessions removed manually',
        unit: '1',
      });

      // Heartbeat counters
      this.heartbeatSuccess = meter.createCounter(SESSION_METRIC_NAMES.HEARTBEAT_SUCCESS, {
        description: 'Successful heartbeat count',
        unit: '1',
      });

      this.heartbeatFailure = meter.createCounter(SESSION_METRIC_NAMES.HEARTBEAT_FAILURE, {
        description: 'Failed heartbeat count',
        unit: '1',
      });

      // Limit reached counter
      this.limitReached = meter.createCounter(SESSION_METRIC_NAMES.LIMIT_REACHED, {
        description: 'Times session limit was reached',
        unit: '1',
      });

      // Cleanup counters
      this.cleanupCyclesCounter = meter.createCounter(SESSION_METRIC_NAMES.CLEANUP_CYCLES, {
        description: 'Number of cleanup cycles executed',
        unit: '1',
      });

      this.cleanupSessionsCounter = meter.createCounter(SESSION_METRIC_NAMES.CLEANUP_SESSIONS, {
        description: 'Total sessions cleaned up',
        unit: '1',
      });

      this.initialized = true;
    } catch {
      // OpenTelemetry not available, continue with in-memory only
      this.initialized = true;
    }
  }

  // ==========================================================================
  // SessionMetricsCollector Implementation
  // ==========================================================================

  recordSessionCreated(transportType?: string): void {
    this.totalCreated++;
    this.currentActiveSessions++;

    if (this.currentActiveSessions > this.peakConcurrentSessions) {
      this.peakConcurrentSessions = this.currentActiveSessions;
    }

    this.sessionsTotal?.add(1, {
      [SESSION_METRIC_ATTRIBUTES.TRANSPORT_TYPE]: transportType ?? 'unknown',
    });
    this.sessionsActive?.add(1);
  }

  recordSessionClosed(reason: string, durationMs: number): void {
    this.currentActiveSessions = Math.max(0, this.currentActiveSessions - 1);
    // Only track duration here for non-timeout closes (timeout duration is tracked in recordSessionExpired)
    if (reason !== 'timeout') {
      this.totalDurationMs += durationMs;
    }

    this.sessionsActive?.add(-1);
    this.sessionDuration?.record(durationMs, {
      [SESSION_METRIC_ATTRIBUTES.CLOSE_REASON]: reason,
    });
  }

  recordSessionExpired(durationMs: number): void {
    this.totalExpired++;
    // Note: Duration is tracked here for expired sessions.
    // currentActiveSessions is decremented separately when the session is actually removed.
    this.totalDurationMs += durationMs;

    this.sessionsExpired?.add(1);
    this.sessionDuration?.record(durationMs, {
      [SESSION_METRIC_ATTRIBUTES.CLOSE_REASON]: 'timeout',
    });
  }

  recordSessionRemoved(): void {
    this.totalRemoved++;
    this.sessionsRemoved?.add(1);
  }

  recordHeartbeatSuccess(): void {
    this.totalHeartbeatSuccess++;
    this.heartbeatSuccess?.add(1);
  }

  recordHeartbeatSuccesses(count: number): void {
    if (count <= 0) return;
    this.totalHeartbeatSuccess += count;
    this.heartbeatSuccess?.add(count);
  }

  recordHeartbeatFailure(): void {
    this.totalHeartbeatFailures++;
    this.heartbeatFailure?.add(1);
  }

  recordHeartbeatFailures(count: number): void {
    if (count <= 0) return;
    this.totalHeartbeatFailures += count;
    this.heartbeatFailure?.add(count);
  }

  recordLimitReached(): void {
    this.limitReachedCount++;
    this.limitReached?.add(1);
  }

  recordCleanupCycle(removedCount: number, extendedCount: number): void {
    this.cleanupCycles++;
    this.sessionsCleanedTotal += removedCount;
    // Note: extendedCount represents sessions kept alive via heartbeat during cleanup
    this.cleanupCyclesCounter?.add(1);
    this.cleanupSessionsCounter?.add(removedCount);
    // Track extended sessions as successful heartbeats
    if (extendedCount > 0) {
      this.totalHeartbeatSuccess += extendedCount;
      this.heartbeatSuccess?.add(extendedCount);
    }
  }

  updateActiveSessionCount(delta: number): void {
    this.currentActiveSessions += delta;

    if (delta > 0 && this.currentActiveSessions > this.peakConcurrentSessions) {
      this.peakConcurrentSessions = this.currentActiveSessions;
    }

    this.sessionsActive?.add(delta);
  }

  getMetricsSnapshot(): DetailedSessionMetrics {
    return {
      totalCreated: this.totalCreated,
      totalExpired: this.totalExpired,
      totalRemoved: this.totalRemoved,
      totalHeartbeatSuccess: this.totalHeartbeatSuccess,
      totalHeartbeatFailures: this.totalHeartbeatFailures,
      limitReachedCount: this.limitReachedCount,
      cleanupCycles: this.cleanupCycles,
      sessionsCleanedTotal: this.sessionsCleanedTotal,
      peakConcurrentSessions: this.peakConcurrentSessions,
      currentActiveSessions: this.currentActiveSessions,
      totalDurationMs: this.totalDurationMs,
      startTime: this.startTime,
    };
  }

  /**
   * Resets all metrics (useful for testing).
   */
  reset(): void {
    this.totalCreated = 0;
    this.totalExpired = 0;
    this.totalRemoved = 0;
    this.totalHeartbeatSuccess = 0;
    this.totalHeartbeatFailures = 0;
    this.limitReachedCount = 0;
    this.cleanupCycles = 0;
    this.sessionsCleanedTotal = 0;
    this.peakConcurrentSessions = 0;
    this.currentActiveSessions = 0;
    this.totalDurationMs = 0;
  }
}

// ============================================================================
// Factory & Singleton
// ============================================================================

/**
 * Extended metrics collector interface with management methods.
 */
export interface SessionMetricsManager extends SessionMetricsCollector {
  /** Initialize OpenTelemetry instruments */
  initialize(serviceName?: string, serviceVersion?: string): void;
  /** Reset all metrics */
  reset(): void;
}

/** Global session metrics instance */
let globalMetrics: SessionMetricsManagerImpl | null = null;

/**
 * Gets the global session metrics collector (singleton).
 *
 * Use this when you want shared metrics across multiple session managers.
 *
 * @returns The global SessionMetricsManager instance
 */
export function getSessionMetrics(): SessionMetricsManager {
  if (!globalMetrics) {
    globalMetrics = new SessionMetricsManagerImpl();
  }
  return globalMetrics;
}

/**
 * Creates a new session metrics collector (factory).
 *
 * Use this for isolated instances (e.g., testing or per-manager metrics).
 *
 * @returns A new SessionMetricsManager instance
 */
export function createSessionMetrics(): SessionMetricsManager {
  return new SessionMetricsManagerImpl();
}

/**
 * Resets the global session metrics (for testing).
 */
export function resetSessionMetrics(): void {
  if (globalMetrics) {
    globalMetrics.reset();
  }
  globalMetrics = null;
}
