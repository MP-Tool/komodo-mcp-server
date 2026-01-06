/**
 * Application-wide constants and default values.
 */

/**
 * Default values for container log operations
 */
export const CONTAINER_LOGS_DEFAULTS = {
  /** Default number of log lines to retrieve */
  TAIL: 100,
  /** Default timestamp setting for logs */
  TIMESTAMPS: false,
} as const;

/**
 * Default values for log search operations
 */
export const LOG_SEARCH_DEFAULTS = {
  /** Default number of lines to retrieve before filtering */
  TAIL: 1000,
  /** Default case sensitivity for search */
  CASE_SENSITIVE: false,
} as const;

/**
 * Limits and constraints for operations
 */
export const LIMITS = {
  /** Maximum number of log lines to retrieve in a single request */
  MAX_LOG_LINES: 10000,
  /** Minimum number of log lines */
  MIN_LOG_LINES: 1,
} as const;

/**
 * Error messages
 */
export const ERROR_MESSAGES = {
  CLIENT_NOT_INITIALIZED: 'Komodo client not initialized',
} as const;
