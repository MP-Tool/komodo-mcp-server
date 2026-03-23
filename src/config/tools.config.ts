/**
 * Tool Configuration
 *
 * Default values and validation limits for MCP tools.
 *
 * @module config/tools
 */

export const VALIDATION_LIMITS = {
  MAX_LOG_TAIL: 10000,
  MAX_STRING_DISPLAY_LENGTH: 50,
  MAX_RESOURCE_NAME_LENGTH: 100,
} as const;

export const CONTAINER_LOGS_DEFAULTS = {
  TAIL: 100,
  TIMESTAMPS: false,
} as const;

export const LOG_SEARCH_DEFAULTS = {
  TAIL: 1000,
  CASE_SENSITIVE: false,
} as const;
