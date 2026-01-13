/**
 * Telemetry Module
 *
 * OpenTelemetry integration for distributed tracing and metrics.
 *
 * ## Setup
 *
 * Enable telemetry with environment variables:
 * ```bash
 * OTEL_ENABLED=true
 * OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
 * ```
 *
 * ## Usage
 *
 * ```typescript
 * import { initializeTelemetry, withSpan, getTraceContext, serverMetrics } from './telemetry/index.js';
 *
 * // Initialize at startup
 * initializeTelemetry();
 *
 * // Create spans
 * await withSpan('myOperation', async (span) => {
 *   span.setAttribute('key', 'value');
 *   return await doSomething();
 * });
 *
 * // Get trace context for propagation
 * const ctx = getTraceContext();
 *
 * // Record metrics
 * serverMetrics.recordRequest('tool_name', 150, true);
 * ```
 *
 * @module server/telemetry
 */

// ============================================================================
// SDK Lifecycle
// ============================================================================

export { initializeTelemetry, shutdownTelemetry, isSdkInitialized } from './sdk.js';

// ============================================================================
// Configuration
// ============================================================================

export { getTelemetryConfig, isTelemetryEnabled } from './core/index.js';
export type { TelemetryConfig } from './core/index.js';

// ============================================================================
// Tracing
// ============================================================================

export {
  getTracer,
  withSpan,
  withSpanSync,
  getActiveSpan,
  addSpanAttributes,
  addSpanEvent,
  getTraceContext,
} from './tracing.js';

export { MCP_ATTRIBUTES } from './core/index.js';
export type { SpanOptions, TraceContext } from './core/index.js';

// ============================================================================
// Metrics
// ============================================================================

export {
  serverMetrics,
  ServerMetricsManager,
  createServerMetrics,
  getServerMetrics,
  resetServerMetrics,
} from './metrics.js';
export { METRIC_ATTRIBUTES } from './core/index.js';
export type { ServerMetrics, ServerStats } from './core/index.js';

// ============================================================================
// Constants (for advanced usage)
// ============================================================================

export {
  TELEMETRY_DEFAULTS,
  TELEMETRY_ENV_VARS,
  METRIC_NAMES,
  METRIC_DESCRIPTIONS,
  METRIC_UNITS,
  TRANSPORT_TYPES,
  TELEMETRY_LOG_COMPONENTS,
  SdkLogMessages,
  MetricsLogMessages,
} from './core/index.js';

// ============================================================================
// OpenTelemetry Re-exports
// ============================================================================

export { SpanKind, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Attributes, Context } from '@opentelemetry/api';
