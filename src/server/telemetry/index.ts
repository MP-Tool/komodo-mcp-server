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
 *   // ...
 * });
 *
 * // Get trace context for propagation
 * const ctx = getTraceContext();
 *
 * // Record metrics
 * serverMetrics.recordRequest('tool_name', 150, true);
 * ```
 *
 * @module telemetry
 */

export { initializeTelemetry, shutdownTelemetry, getTelemetryConfig, type TelemetryConfig } from './config.js';

export {
  getTracer,
  withSpan,
  withSpanSync,
  getActiveSpan,
  addSpanAttributes,
  addSpanEvent,
  getTraceContext,
  MCP_ATTRIBUTES,
  type SpanOptions,
} from './tracing.js';

export {
  serverMetrics,
  ServerMetricsManager,
  METRIC_ATTRIBUTES,
  type ServerMetrics,
  type ServerStats,
} from './metrics.js';

// Re-export useful OpenTelemetry types
export { SpanKind, SpanStatusCode } from '@opentelemetry/api';
export type { Span, Attributes, Context } from '@opentelemetry/api';
