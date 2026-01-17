/**
 * Session Operations Module
 *
 * Exports session operations for lifecycle management, cleanup, and heartbeats.
 * These are the low-level building blocks used by TransportSessionManager.
 *
 * @module session/operations
 */

// Lifecycle
export {
  createSessionData,
  addSession,
  getSession,
  touchSession,
  hasSession,
  removeSession,
  closeAllSessions,
} from './lifecycle.js';

// Cleanup
export {
  cleanupExpiredSessions,
  getSessionIdleTime,
  isSessionExpired,
  type CleanupResult,
  type CleanedSession,
  type ExtendedSession,
} from './cleanup.js';

// Heartbeat
export {
  hasHeartbeat,
  sendHeartbeatSafe,
  sendKeepAlives,
  sendHeartbeat,
  isSessionDead,
  type HeartbeatResult,
  type RemovedSession,
} from './heartbeat.js';
