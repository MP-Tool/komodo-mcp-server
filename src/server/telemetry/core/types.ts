/**
 * Telemetry Module Types
 *
 * Centralized type definitions for the OpenTelemetry integration module.
 * Includes configuration, tracing, and metrics types.
 *
 * @module server/telemetry/core/types
 */

import type { Span, SpanKind, Attributes, Context } from '@opentelemetry/api';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * OpenTelemetry configuration options.
 */
export interface TelemetryConfig {
  /** Whether OpenTelemetry is enabled */
  readonly enabled: boolean;
  /** Service name for traces */
  readonly serviceName: string;
  /** Service version */
  readonly serviceVersion: string;
  /** Deployment environment */
  readonly environment: string;
  /** OTLP endpoint URL */
  readonly endpoint?: string;
  /** Enable debug logging */
  readonly debug?: boolean;
}

// ============================================================================
// Tracing Types
// ============================================================================

/**
 * Options for creating a span.
 */
export interface SpanOptions {
  /** Span kind (default: INTERNAL) */
  kind?: SpanKind;
  /** Initial attributes */
  attributes?: Attributes;
  /** Parent context (uses active context if not provided) */
  parentContext?: Context;
}

/**
 * Trace context for propagation to external services.
 */
export interface TraceContext {
  /** Trace ID */
  readonly traceId: string;
  /** Span ID */
  readonly spanId: string;
}

/**
 * Function signature for span execution callback.
 */
export type SpanCallback<T> = (span: Span) => T;

/**
 * Function signature for async span execution callback.
 */
export type AsyncSpanCallback<T> = (span: Span) => Promise<T>;

// ============================================================================
// Metrics Types
// ============================================================================

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
  readonly uptimeMs: number;
  /** Server start time */
  readonly startTime: Date;
  /** Total requests processed */
  readonly totalRequests: number;
  /** Failed requests */
  readonly failedRequests: number;
  /** Active HTTP sessions */
  readonly activeHttpSessions: number;
  /** Active Legacy SSE sessions */
  readonly activeLegacySseSessions: number;
  /** Connection state changes count */
  readonly connectionStateChanges: number;
  /** Current memory usage in bytes */
  readonly memoryUsageBytes: number;
  /** Current heap used in bytes */
  readonly heapUsedBytes: number;
}

/**
 * Transport types for session tracking.
 */
export type TransportType = 'http' | 'legacy-sse' | 'stdio';

// ============================================================================
// Re-export OpenTelemetry Types (for convenience)
// These are re-exported so consumers don't need to import from @opentelemetry/api
// ============================================================================

export type { Span, SpanKind, Attributes, Context } from '@opentelemetry/api';
