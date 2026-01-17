/**
 * API Connection Module
 *
 * Manages API connection state and request lifecycle for the MCP framework.
 * This module is generic and client-agnostic - it works with any IApiClient.
 *
 * This module handles the connection to backend API servers, NOT the MCP transport layer.
 * For transport lifecycle, see the transport-specific modules (sse/lifecycle, streamable-http/lifecycle).
 *
 * @module server/connection
 */

// ============================================================================
// Core Types and Constants (centralized)
// ============================================================================

// Re-export all types from core
export type {
  // Connection State Types
  ConnectionState,
  ConnectionStateListener,
  ConnectionStateEvent,
  ConnectionStateStats,
  // Request Manager Types
  RequestId,
  ProgressToken,
  ActiveRequest,
  ProgressData,
  ProgressReporter,
  RequestManagerStats,
  ProgressNotificationParams,
  RateLimitEntry,
  // Connection Error Types
  ConnectionErrorCode,
  ConnectionErrorOptions,
} from './core/index.js';

// Re-export error classes from core
export {
  ConnectionErrorCodes,
  ConnectionError,
  getMcpCodeForConnectionError,
  getHttpStatusForConnectionError,
} from './core/index.js';

// Re-export constants from core
export {
  CONNECTION_STATES,
  CONNECTION_STATE_CONFIG,
  REQUEST_MANAGER_CONFIG,
  CONNECTION_LOG_COMPONENTS,
  CONNECTION_MCP_SPEC,
  CONNECTION_NOTIFICATION_METHODS,
  ConnectionStateLogMessages,
  RequestManagerLogMessages,
  ClientInitializerLogMessages,
} from './core/index.js';

// ============================================================================
// Connection State Management (generic)
// ============================================================================

export { connectionManager, ConnectionStateManager } from './connection-state.js';

// ============================================================================
// Request Lifecycle Management
// ============================================================================

export { requestManager, RequestManager } from './request-manager.js';
