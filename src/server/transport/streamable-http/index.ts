/**
 * Streamable HTTP Transport Module
 *
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification)
 *
 * @module server/transport/streamable-http
 */

export { createStreamableHttpRouter } from './routes.js';
export type { McpServerFactory } from './types.js';

// Lifecycle types and constants
export type {
  HttpTransportState,
  HttpTransportStateListener,
  HttpTransportStateEvent,
  HttpSessionInitResult,
  HttpSessionTerminationReason,
  HttpSessionTerminationEvent,
  HttpRequestLifecycle,
  HttpTransportMetrics,
  HttpSessionHealth,
} from './lifecycle/index.js';

export {
  HTTP_TRANSPORT_STATES,
  HTTP_TRANSPORT_CONFIG,
  MCP_HTTP_HEADERS,
  HTTP_HEADERS,
  HTTP_LIFECYCLE_LOG_COMPONENTS,
  HttpLifecycleLogMessages,
  HTTP_TELEMETRY_ATTRIBUTES,
  HTTP_TRANSPORT_ERRORS,
} from './lifecycle/index.js';
