/**
 * SSE Transport Module
 *
 * Legacy HTTP+SSE Transport (deprecated protocol 2024-11-05)
 * Still supported for backwards compatibility with older MCP clients.
 *
 * @module server/transport/sse
 */

// Transport class
export { SseTransport, LegacySseTransport } from './transport.js';

// Routes and handlers
export {
  createSseRouter,
  createLegacySseRouter,
  handleSseConnection,
  handleLegacySseConnection,
  getSseSessionCount,
  getLegacySseSessionCount,
  closeAllSseSessions,
  closeAllLegacySseSessions,
  isSseEnabled,
  isLegacySseEnabled,
} from './routes.js';

// Types
export type { McpServerFactory } from './types.js';

// Lifecycle types and constants
export type {
  SseTransportState,
  SseTransportStateListener,
  SseTransportStateEvent,
  SseConnectionMetrics,
  SseConnectionHealth,
  SseReconnectionConfig,
  SseReconnectionState,
} from './lifecycle/index.js';

export {
  SSE_TRANSPORT_STATES,
  SSE_TRANSPORT_CONFIG,
  SSE_RECONNECTION_DEFAULTS,
  SSE_LIFECYCLE_LOG_COMPONENTS,
  SSE_EVENT_NAMES,
  SseLifecycleLogMessages,
  SSE_TELEMETRY_ATTRIBUTES,
} from './lifecycle/index.js';
