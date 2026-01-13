/**
 * Telemetry Core Module
 *
 * Barrel export for centralized types, constants, and configuration.
 *
 * @module server/telemetry/core
 */

// ============================================================================
// Types
// ============================================================================

export type {
  // Configuration
  TelemetryConfig,
  // Tracing
  SpanOptions,
  TraceContext,
  SpanCallback,
  AsyncSpanCallback,
  // Metrics
  ServerMetrics,
  ServerStats,
  TransportType,
  // Re-exports from OpenTelemetry
  Span,
  Attributes,
  Context,
  SpanKind,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

export {
  // Configuration
  TELEMETRY_DEFAULTS,
  TELEMETRY_ENV_VARS,
  // Semantic Attributes
  MCP_ATTRIBUTES,
  METRIC_ATTRIBUTES,
  // Metric Names
  METRIC_NAMES,
  METRIC_DESCRIPTIONS,
  METRIC_UNITS,
  // Log Components
  TELEMETRY_LOG_COMPONENTS,
  // Log Messages
  SdkLogMessages,
  MetricsLogMessages,
  // Transport Types
  TRANSPORT_TYPES,
} from './constants.js';

// ============================================================================
// Configuration
// ============================================================================

export { getTelemetryConfig, isTelemetryEnabled } from './config.js';
