import { z } from 'zod';

/**
 * Zod schema for environment variable validation.
 * Ensures that the application starts with a valid configuration.
 */
export const envSchema = z.object({
  /** Application version (defaults to package.json version) */
  VERSION: z.string().default(process.env.npm_package_version || 'unknown'),
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
  KOMODO_USERNAME: z.string().optional(),
  /** Komodo Password (optional, for auto-config) */
  KOMODO_PASSWORD: z.string().optional(),
  /** Komodo API Key (optional, for auto-config) */
  KOMODO_API_KEY: z.string().optional(),
  /** Komodo API Secret (optional, for auto-config) */
  KOMODO_API_SECRET: z.string().optional(),
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
});

/**
 * Global configuration object parsed from environment variables.
 * Throws an error if validation fails.
 */
export const config = envSchema.parse(process.env);
