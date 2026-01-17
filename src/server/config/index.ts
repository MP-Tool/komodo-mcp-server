/**
 * Server Framework Configuration
 *
 * Aggregates all framework configuration into a single module.
 * This provides a central access point for all server framework settings.
 *
 * @module server/config
 */

// ============================================================================
// Environment Configuration
// ============================================================================

export { frameworkEnvSchema, parseFrameworkEnv, type FrameworkEnvConfig } from './env.js';

// ============================================================================
// Server Configuration
// ============================================================================

export {
  createServerConfig,
  defaultServerConfig,
  SERVER_CONFIG_DEFAULTS,
  type ServerConfig,
  type ServerConfigOptions,
} from './server.config.js';

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
  createAllowedHosts,
  createAllowedOrigins,
  isLocalHost,
  // Aggregated config
  TRANSPORT_CONFIG,
} from './transport.config.js';

// ============================================================================
// Aggregated Framework Configuration
// ============================================================================

import { SERVER_CONFIG_DEFAULTS } from './server.config.js';
import { TRANSPORT_CONFIG } from './transport.config.js';

/**
 * Aggregated framework configuration.
 *
 * Combines all framework-level configurations for centralized access.
 * Apps should extend this with their own app-specific config.
 *
 * @example
 * ```typescript
 * import { FRAMEWORK_CONFIG } from './server/config/index.js';
 *
 * // Access transport settings
 * const sessionTimeout = FRAMEWORK_CONFIG.transport.session.TIMEOUT_MS;
 *
 * // Access server defaults
 * const defaultName = FRAMEWORK_CONFIG.server.NAME;
 * ```
 */
export const FRAMEWORK_CONFIG = {
  /** Server configuration defaults */
  server: SERVER_CONFIG_DEFAULTS,
  /** Transport layer configuration */
  transport: TRANSPORT_CONFIG,
} as const;

/**
 * Type for the aggregated framework configuration.
 */
export type FrameworkConfig = typeof FRAMEWORK_CONFIG;
