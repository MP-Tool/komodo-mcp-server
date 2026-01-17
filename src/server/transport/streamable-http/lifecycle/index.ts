/**
 * Streamable HTTP Transport Lifecycle Module
 *
 * Barrel export for Streamable HTTP transport lifecycle types and constants.
 * Implements MCP Streamable HTTP Transport (2025-03-26 Specification).
 *
 * @module server/transport/streamable-http/lifecycle
 */

// Types
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
} from './types.js';

export { HTTP_TRANSPORT_STATES } from './types.js';

// Constants
export {
  HTTP_TRANSPORT_CONFIG,
  MCP_HTTP_HEADERS,
  HTTP_HEADERS,
  HTTP_LIFECYCLE_LOG_COMPONENTS,
  HttpLifecycleLogMessages,
  HTTP_TELEMETRY_ATTRIBUTES,
  HTTP_TRANSPORT_ERRORS,
} from './constants.js';
