/**
 * Connection Core Module
 *
 * Barrel export for centralized types and constants.
 *
 * @module server/connection/core
 */

// Types
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
} from './types.js';

export { CONNECTION_STATES } from './types.js';

// Constants
export {
  // Configuration
  CONNECTION_STATE_CONFIG,
  REQUEST_MANAGER_CONFIG,
  // Log Components (new naming)
  CONNECTION_LOG_COMPONENTS,
  // MCP Spec References (new naming)
  CONNECTION_MCP_SPEC,
  // Notification Methods (new naming)
  CONNECTION_NOTIFICATION_METHODS,
  // Log Messages
  ConnectionStateLogMessages,
  RequestManagerLogMessages,
  ClientInitializerLogMessages,
} from './constants.js';
