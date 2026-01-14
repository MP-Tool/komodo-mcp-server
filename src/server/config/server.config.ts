/**
 * MCP Server Configuration Factory
 *
 * Provides a factory function for creating server configuration.
 * This allows the framework to be reusable with different server names.
 *
 * @module server/config/server
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Server configuration options interface.
 */
export interface ServerConfigOptions {
  /** Server name - identifies the MCP server to clients */
  name?: string;

  /** Server version - typically from package.json */
  version?: string;

  /** Environment variable for version override */
  versionEnvVar?: string;

  /** Shutdown timeout in milliseconds */
  shutdownTimeoutMs?: number;
}

/**
 * Readonly server configuration type.
 */
export interface ServerConfig {
  readonly SERVER_NAME: string;
  readonly SERVER_VERSION: string;
  readonly SHUTDOWN_CONFIG: {
    readonly TIMEOUT_MS: number;
  };
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default configuration values.
 */
export const SERVER_CONFIG_DEFAULTS = {
  /** Generic default name */
  NAME: 'mcp-server',
  /** Fallback version */
  VERSION: '0.0.0',
  /** Standard npm env var */
  VERSION_ENV_VAR: 'npm_package_version',
  /** 10 seconds shutdown timeout */
  SHUTDOWN_TIMEOUT_MS: 10000,
} as const;

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Resolve version from options or environment.
 */
function resolveVersion(options: ServerConfigOptions): string {
  // 1. Explicitly provided version takes precedence
  if (options.version) {
    return options.version;
  }

  // 2. Environment variable (customizable)
  const envVar = options.versionEnvVar ?? SERVER_CONFIG_DEFAULTS.VERSION_ENV_VAR;
  const envVersion = process.env[envVar];
  if (envVersion) {
    return envVersion;
  }

  // 3. Fallback
  return SERVER_CONFIG_DEFAULTS.VERSION;
}

/**
 * Create server configuration with factory pattern.
 *
 * @param options - Configuration options
 * @returns Frozen server configuration object
 *
 * @example
 * ```typescript
 * // In app layer (Komodo-specific)
 * export const serverConfig = createServerConfig({
 *   name: 'komodo-mcp-server',
 *   version: '1.0.0',
 * });
 *
 * // Access values
 * console.log(serverConfig.SERVER_NAME); // 'komodo-mcp-server'
 * ```
 */
export function createServerConfig(options: ServerConfigOptions = {}): ServerConfig {
  const version = resolveVersion(options);

  const config: ServerConfig = {
    SERVER_NAME: options.name ?? SERVER_CONFIG_DEFAULTS.NAME,
    SERVER_VERSION: version,
    SHUTDOWN_CONFIG: {
      TIMEOUT_MS: options.shutdownTimeoutMs ?? SERVER_CONFIG_DEFAULTS.SHUTDOWN_TIMEOUT_MS,
    },
  };

  // Freeze for immutability
  return Object.freeze(config);
}

// ============================================================================
// Default Instance
// ============================================================================

/**
 * Default server configuration instance.
 * Uses defaults from SERVER_CONFIG_DEFAULTS.
 * Apps should create their own instance with createServerConfig().
 */
export const defaultServerConfig = createServerConfig();
