/**
 * Framework Environment Configuration
 *
 * Environment variables for the generic MCP server framework.
 * These settings are NOT application-specific and apply to any MCP server
 * built with this framework.
 *
 * @module server/config/env
 */

import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ============================================================================
// Version Resolution
// ============================================================================

/** Path to baked-in VERSION file (created during Docker build) */
const VERSION_FILE_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'VERSION');

/**
 * Resolve application version from available sources.
 *
 * Single Source of Truth: package.json
 *
 * Resolution:
 * - Docker: Reads from build/VERSION (baked in from package.json during build)
 * - npm run: Uses npm_package_version (injected by npm from package.json)
 *
 * @returns Version string or 'unknown' if resolution fails
 */
function resolveVersion(): string {
  // Docker: VERSION file is baked in during build
  try {
    return readFileSync(VERSION_FILE_PATH, 'utf-8').trim();
  } catch {
    // Not running in Docker container
  }

  // npm run: npm injects version from package.json
  return process.env.npm_package_version ?? 'unknown';
}

/** Cached version - resolved once at module load */
const VERSION = resolveVersion();

// ============================================================================
// Schema Definition
// ============================================================================

/**
 * Framework environment schema - application-agnostic settings.
 *
 * Includes:
 * - Application metadata (version, environment)
 * - MCP Transport settings (host, port, transport mode)
 * - Security settings (CORS, DNS rebinding protection, rate limiting)
 * - Logging configuration
 * - OpenTelemetry settings
 */
export const frameworkEnvSchema = z.object({
  // --------------------------------------------------------------------------
  // Application Metadata
  // --------------------------------------------------------------------------

  /**
   * Application version (resolved at module load).
   *
   * Source of Truth: package.json
   * - Docker: build/VERSION file (baked in during build)
   * - npm run: npm_package_version environment variable
   */
  VERSION: z.string().default(VERSION),

  /** Node environment (development, production, test) */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // --------------------------------------------------------------------------
  // MCP Transport Settings
  // --------------------------------------------------------------------------

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

  /**
   * Enable Legacy SSE Transport (deprecated HTTP+SSE from protocol 2024-11-05)
   * Default: false (only Streamable HTTP Transport enabled)
   * Set to 'true' to enable backwards compatibility with older MCP clients
   */
  MCP_LEGACY_SSE_ENABLED: z
    .boolean()
    .or(z.string().transform((val) => val.toLowerCase() === 'true'))
    .default(false),

  // --------------------------------------------------------------------------
  // Security Settings
  // --------------------------------------------------------------------------

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

  /** Rate limit window in milliseconds (default: 900000 = 15 minutes) */
  MCP_RATE_LIMIT_WINDOW_MS: z.coerce.number().min(1000).default(900000),

  /** Maximum requests per rate limit window (default: 1000) */
  MCP_RATE_LIMIT_MAX: z.coerce.number().min(100).default(1000),

  // --------------------------------------------------------------------------
  // Logging Configuration
  // --------------------------------------------------------------------------

  /** Log level (trace, debug, info, warn, error) */
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),

  /** Log format (text, json) */
  LOG_FORMAT: z.enum(['text', 'json']).default('text'),

  /** Directory to store logs (optional) */
  LOG_DIR: z.string().optional(),

  // --------------------------------------------------------------------------
  // OpenTelemetry Configuration
  // --------------------------------------------------------------------------

  /** Enable OpenTelemetry distributed tracing (default: false) */
  OTEL_ENABLED: z
    .boolean()
    .or(z.string().transform((val) => val.toLowerCase() === 'true'))
    .default(false),

  /** OpenTelemetry service name (default: 'mcp-server') */
  OTEL_SERVICE_NAME: z.string().default('mcp-server'),

  /** OTLP exporter endpoint URL (e.g., http://localhost:4318) */
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),

  /** Enable OpenTelemetry debug logging (default: false) */
  OTEL_DEBUG: z
    .boolean()
    .or(z.string().transform((val) => val.toLowerCase() === 'true'))
    .default(false),
});

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Framework environment configuration type.
 */
export type FrameworkEnvConfig = z.infer<typeof frameworkEnvSchema>;

/**
 * Parse and validate framework environment variables.
 *
 * @returns Validated framework configuration
 */
export function parseFrameworkEnv(): FrameworkEnvConfig {
  return frameworkEnvSchema.parse(process.env);
}
