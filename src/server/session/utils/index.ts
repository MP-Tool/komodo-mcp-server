/**
 * Session Utilities Module
 *
 * Exports utility functions for session management including
 * formatting, validation, and helper functions.
 *
 * @module session/utils
 */

// Formatting
export {
  formatSessionId,
  formatSessionIdFull,
  formatDuration,
  formatIdleTime,
  getSessionStats,
  formatSessionStats,
  formatSessionList,
} from './format.js';

// Validation
export {
  isValidSessionId,
  validateSessionId,
  type SessionIdValidationResult,
  isSessionHealthy,
  canAddSession,
  getRemainingCapacity,
} from './validation.js';
