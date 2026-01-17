/**
 * Tool Configuration
 *
 * Default values and configuration for MCP tools.
 * Contains defaults for container logs, search, prune operations, etc.
 *
 * @module config/tools
 */

// ============================================================================
// Validation Constants
// ============================================================================

/**
 * Validation limits for API operations
 */
export const VALIDATION_LIMITS = {
  /** Maximum number of log lines that can be retrieved */
  MAX_LOG_TAIL: 10000,
  /** Maximum length for string truncation in error messages */
  MAX_STRING_DISPLAY_LENGTH: 50,
  /** Maximum length for resource names (servers, stacks, etc.) */
  MAX_RESOURCE_NAME_LENGTH: 100,
} as const;

// ============================================================================
// Container Log Defaults
// ============================================================================

/**
 * Default values for container log operations (komodo_get_container_logs)
 */
export const CONTAINER_LOGS_DEFAULTS = {
  /** Default number of log lines to retrieve */
  TAIL: 100,
  /** Default timestamp setting for logs */
  TIMESTAMPS: false,
} as const;

/**
 * Default values for log search operations (komodo_search_logs)
 */
export const LOG_SEARCH_DEFAULTS = {
  /** Default number of lines to retrieve before filtering */
  TAIL: 1000,
  /** Default case sensitivity for search */
  CASE_SENSITIVE: false,
} as const;
