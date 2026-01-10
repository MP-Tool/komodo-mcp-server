import { z } from 'zod';

/**
 * Environment Configuration Module
 *
 * Provides validated environment variable access with Zod schemas.
 * Supports both static (build-time) and runtime environment reading,
 * which is essential for Docker containers using env_file.
 *
 * @module config/env
 */

/**
 * Zod schema for environment variable validation.
 * Ensures that the application starts with a valid configuration.
 */
export const envSchema = z.object({
  /* v8 ignore start - environment-dependent default */
  /** Application version (defaults to package.json version) */
  VERSION: z.string().default(process.env.npm_package_version || 'unknown'),
  /* v8 ignore stop */
  /** Node environment (development, production, test) */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Host to bind the MCP server to (default: 127.0.0.1) */
  MCP_BIND_HOST: z.string().default('127.0.0.1'),
  /** Port to listen on (default: 3000) */
  MCP_PORT: z
    .string()
    .transform((val) => parseInt(val, 10))
    .refine((val) => !isNaN(val), { message: 'Port must be a valid number' })
    .default('3000'),
  /** Transport mode: 'stdio' for CLI, 'http' for HTTP (default: http) */
  MCP_TRANSPORT: z.enum(['stdio', 'http']).default('http'),
  /** Allowed origins for CORS (comma-separated) */
  MCP_ALLOWED_ORIGINS: z
    .string()
    .transform((val) => {
      const list = val
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
      return list.length > 0 ? list : undefined;
    })
    .optional(),
  /** Allowed hosts for DNS rebinding protection (comma-separated) */
  MCP_ALLOWED_HOSTS: z
    .string()
    .transform((val) => {
      const list = val
        .split(',')
        .map((h) => h.trim())
        .filter((h) => h.length > 0);
      return list.length > 0 ? list : undefined;
    })
    .optional(),
  /** Komodo Server URL (optional, for auto-config) */
  KOMODO_URL: z.string().url().optional(),
  /** Komodo Username (optional, for auto-config) */
  KOMODO_USERNAME: z.string().min(1).optional(),
  /** Komodo Password (optional, for auto-config) */
  KOMODO_PASSWORD: z.string().min(1).optional(),
  /** Komodo API Key (optional, for auto-config) */
  KOMODO_API_KEY: z.string().min(1).optional(),
  /** Komodo API Secret (optional, for auto-config) */
  KOMODO_API_SECRET: z.string().min(1).optional(),
  /** Log level (trace, debug, info, warn, error) */
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  /** Log format (text, json) */
  LOG_FORMAT: z.enum(['text', 'json']).default('text'),
  /** Directory to store logs */
  LOG_DIR: z.string().optional(),
  /**
   * Enable Legacy SSE Transport (deprecated HTTP+SSE from protocol 2024-11-05)
   * Default: false (only Streamable HTTP Transport enabled)
   * Set to 'true' to enable backwards compatibility with older MCP clients
   */
  MCP_LEGACY_SSE_ENABLED: z
    .boolean()
    .or(z.string().transform((val) => val.toLowerCase() === 'true'))
    .default(false),
  /**
   * API request timeout in milliseconds
   * Default: 30000 (30 seconds)
   */
  API_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(30000),
  /**
   * Rate limit window in milliseconds
   * Default: 900000 (15 minutes)
   */
  MCP_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000),
  /**
   * Maximum requests per rate limit window
   * Default: 1000
   */
  MCP_RATE_LIMIT_MAX: z.coerce.number().min(100).default(1000),
  /**
   * Enable OpenTelemetry distributed tracing
   * Default: false
   */
  OTEL_ENABLED: z
    .boolean()
    .or(z.string().transform((val) => val.toLowerCase() === 'true'))
    .default(false),
  /**
   * OpenTelemetry service name
   * Default: 'komodo-mcp-server'
   */
  OTEL_SERVICE_NAME: z.string().default('komodo-mcp-server'),
  /**
   * OTLP exporter endpoint URL
   * Example: http://localhost:4318
   */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  /**
   * Enable OpenTelemetry debug logging
   * Default: false
   */
  OTEL_DEBUG: z
    .boolean()
    .or(z.string().transform((val) => val.toLowerCase() === 'true'))
    .default(false),
});

/**
 * Global configuration object parsed from environment variables.
 * Note: For Docker containers, use getKomodoCredentials() to read
 * credentials at runtime when env_file is used.
 */
export const config = envSchema.parse(process.env);

// ============================================================================
// Runtime Environment Access
// ============================================================================

/**
 * Safely reads a runtime environment variable.
 * Use this for values that may be set via Docker env_file at container start.
 *
 * @param key - The environment variable name
 * @returns The trimmed value or undefined if empty/not set
 *
 * @example
 * ```typescript
 * const apiKey = getEnv('KOMODO_API_KEY');
 * if (apiKey) {
 *   // Use the API key
 * }
 * ```
 */
function getEnv(key: string): string | undefined {
  const value = process.env[key];
  // Treat empty strings as undefined (common Docker/shell behavior)
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

/**
 * Komodo credentials structure for runtime access.
 */
export interface KomodoCredentials {
  /** Komodo server URL */
  url?: string;
  /** Username for password authentication */
  username?: string;
  /** Password for password authentication */
  password?: string;
  /** API key for key-based authentication */
  apiKey?: string;
  /** API secret for key-based authentication */
  apiSecret?: string;
}

/**
 * Gets Komodo credentials from runtime environment.
 *
 * Reads directly from process.env to get values set by Docker at container start.
 * This is essential when using Docker Compose with env_file, as those variables
 * are only available at runtime, not when the module is first loaded.
 *
 * @returns Object with URL and credentials (if available)
 *
 * @example
 * ```typescript
 * const creds = getKomodoCredentials();
 * if (creds.url && creds.username && creds.password) {
 *   const client = await KomodoClient.login(creds.url, creds.username, creds.password);
 * }
 * ```
 */
export function getKomodoCredentials(): KomodoCredentials {
  return {
    url: getEnv('KOMODO_URL'),
    username: getEnv('KOMODO_USERNAME'),
    password: getEnv('KOMODO_PASSWORD'),
    apiKey: getEnv('KOMODO_API_KEY'),
    apiSecret: getEnv('KOMODO_API_SECRET'),
  };
}
