/**
 * Server Module
 *
 * Exports server-related utilities for the Komodo MCP Server.
 *
 * @module server
 */

// Server utils
export {
  setupCancellationHandler,
  setupPingHandler,
  initializeClientFromEnv,
  connectionManager,
  requestManager,
  ConnectionStateManager,
  RequestManager,
  type ConnectionState,
  type ProgressData,
} from './utils/index.js';

// Telemetry
export {
  initializeTelemetry,
  shutdownTelemetry,
  getTelemetryConfig,
  getTracer,
  withSpan,
  withSpanSync,
  getActiveSpan,
  addSpanAttributes,
  addSpanEvent,
  getTraceContext,
  MCP_ATTRIBUTES,
  SpanKind,
  SpanStatusCode,
  serverMetrics,
  ServerMetricsManager,
  METRIC_ATTRIBUTES,
  type TelemetryConfig,
  type SpanOptions,
  type ServerMetrics,
  type ServerStats,
} from './telemetry/index.js';

// Transport
export { startHttpServer } from './transport/index.js';
