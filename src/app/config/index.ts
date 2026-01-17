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
 * - **mcp**: MCP module aggregation (prompts, resources, tools)
 *
 * @example
 * ```typescript
 * import {
 *   config,
 *   SERVER_NAME,
 *   SERVER_VERSION,
 *   SESSION_TIMEOUT_MS,
 *   CONTAINER_LOGS_DEFAULTS,
 *   MCP_CONFIG,
 * } from './config/index.js';
 * ```
 *
 * @module config
 */

// ============================================================================
// Environment Configuration
// ============================================================================

export { config, getKomodoCredentials, parseFrameworkEnv } from './env.js';
export type { FrameworkEnvConfig, AppEnvConfig, KomodoCredentials } from './env.js';

// ============================================================================
// Server Identity Configuration
// ============================================================================

import { config } from './env.js';

/** Server name as advertised to MCP clients */
export const SERVER_NAME = 'komodo-mcp-server';

/** Server version (from package.json via environment) */
export const SERVER_VERSION = config.VERSION;

/** Shutdown timeout configuration */
export const SHUTDOWN_CONFIG = {
  /** Maximum time to wait for graceful shutdown (in milliseconds) */
  TIMEOUT_MS: 10000,
} as const;

// ============================================================================
// Transport Configuration
// ============================================================================

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

// ============================================================================
// Tool Configuration
// ============================================================================

export { CONTAINER_LOGS_DEFAULTS, LOG_SEARCH_DEFAULTS, VALIDATION_LIMITS } from './tools.config.js';

// ============================================================================
// Schema Descriptions
// ============================================================================

export {
  PARAM_DESCRIPTIONS,
  CONFIG_DESCRIPTIONS,
  LOG_DESCRIPTIONS,
  FIELD_DESCRIPTIONS,
  RESTART_MODE_DESCRIPTIONS,
  PRUNE_TARGET_DESCRIPTIONS,
  ALERT_DESCRIPTIONS,
  THRESHOLD_DESCRIPTIONS,
  RESPONSE_ICONS,
} from './descriptions.js';

// ============================================================================
// MCP Module Configuration
// ============================================================================

export { MCP_CONFIG, PROMPT_CONFIG, RESOURCE_CONFIG, TOOL_CONFIG } from './mcp.config.js';

export type {
  McpConfig,
  PromptConfig,
  ResourceConfig,
  ToolConfig,
  PromptCategory,
  ResourceCategory,
  ToolCategory,
} from './mcp.config.js';
