/**
 * SSE Transport Lifecycle Module
 *
 * Barrel export for SSE transport lifecycle types and constants.
 *
 * @module server/transport/sse/lifecycle
 */

// Types
export type {
  SseTransportState,
  SseTransportStateListener,
  SseTransportStateEvent,
  SseConnectionMetrics,
  SseConnectionHealth,
  SseReconnectionConfig,
  SseReconnectionState,
} from './types.js';

export { SSE_TRANSPORT_STATES } from './types.js';

// Constants
export {
  SSE_TRANSPORT_CONFIG,
  SSE_RECONNECTION_DEFAULTS,
  SSE_LIFECYCLE_LOG_COMPONENTS,
  SSE_EVENT_NAMES,
  SseLifecycleLogMessages,
  SSE_TELEMETRY_ATTRIBUTES,
} from './constants.js';
