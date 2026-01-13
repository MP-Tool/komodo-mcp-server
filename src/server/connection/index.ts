/**
 * Komodo API Connection Module
 *
 * Manages Komodo API connection including connection state, request tracking, and client initialization.
 * Provides centralized types and constants for the connection module.
 *
 * This module handles the connection to the Komodo Core API server, NOT the MCP transport layer.
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
  // Client Initializer Types
  ClientInitResult,
  ClientEnvConfig,
} from './core/index.js';

// Re-export constants from core (new naming)
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
// Connection State Management
// ============================================================================

export { connectionManager, ConnectionStateManager } from './connection-state.js';

// ============================================================================
// Request Lifecycle Management
// ============================================================================

export { requestManager, RequestManager } from './request-manager.js';

// ============================================================================
// Client Initialization
// ============================================================================

export { initializeClientFromEnv } from './client-initializer.js';
