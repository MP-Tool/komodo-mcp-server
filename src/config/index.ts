/**
 * Configuration Module
 *
 * Centralized configuration for the Komodo MCP Server.
 * Organized into logical categories:
 *
 * - **env**: Environment variables (parsed and validated)
 * - **server**: MCP server identity and capabilities
 * - **transport**: Session management, protocol versions, security
 * - **tools**: Tool defaults (logs, prune, container operations)
 * - **descriptions**: Reusable schema descriptions
 * - **errors**: Centralized error codes and messages
 *
 * @example
 * ```typescript
 * // Import specific configs
 * import { config } from './config/index.js';
 * import {
 * SERVER_NAME,
 *   SERVER_VERSION,
 *   SESSION_TIMEOUT_MS ,
 *   CONTAINER_LOGS_DEFAULTS,
 *   JsonRpcErrorCode,
 *   HttpStatus
 * } from './config/index.js';
 * ```
 *
 * @module config
 */

// Environment configuration (validated env vars)
export { config, getKomodoCredentials } from './env.js';

// Server configuration (identity, capabilities)
export { SERVER_NAME, SERVER_VERSION } from './server.config.js';

// Transport configuration (sessions, protocol, security)
export {
  // Protocol versions
  SUPPORTED_PROTOCOL_VERSIONS,
  FALLBACK_PROTOCOL_VERSION,
  // Session management
  SESSION_TIMEOUT_MS,
  SESSION_CLEANUP_INTERVAL_MS,
  SESSION_KEEP_ALIVE_INTERVAL_MS,
  SESSION_MAX_MISSED_HEARTBEATS,
  SESSION_MAX_COUNT,
  LEGACY_SSE_MAX_SESSIONS,
  // Security helpers
  getAllowedHosts,
  getAllowedOrigins,
  isLocalHost,
} from './transport.config.js';

// Tool configuration (defaults for tool operations)
export { CONTAINER_LOGS_DEFAULTS, LOG_SEARCH_DEFAULTS } from './tools.config.js';

// Error messages for tools (legacy alias - prefer ToolErrorMessage)
export { ERROR_MESSAGES } from './errors.config.js';

// Descriptions for schema documentation
export {
  PARAM_DESCRIPTIONS,
  CONFIG_DESCRIPTIONS,
  LOG_DESCRIPTIONS,
  FIELD_DESCRIPTIONS,
  RESTART_MODE_DESCRIPTIONS,
  PRUNE_TARGET_DESCRIPTIONS,
  ALERT_DESCRIPTIONS,
  THRESHOLD_DESCRIPTIONS,
} from './descriptions.js';

// Error codes and messages
export {
  // JSON-RPC errors
  JsonRpcErrorCode,
  // HTTP errors
  HttpStatus,
  // Transport errors
  TransportErrorMessage,
} from './errors.config.js';

// Re-export types
export type { JsonRpcErrorCodeValue } from './errors.config.js';
