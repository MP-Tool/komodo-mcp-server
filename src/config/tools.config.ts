/**
 * Tool Configuration
 *
 * Default values and configuration for MCP tools.
 * Contains defaults for container logs, search, prune operations, etc.
 *
 * @module config/tools
 */

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
