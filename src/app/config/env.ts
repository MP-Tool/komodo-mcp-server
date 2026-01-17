/**
 * Environment Configuration Module
 *
 * Consolidated environment variable handling for the Komodo MCP Server.
 * Combines framework and application schemas with runtime credential access.
 *
 * @module config/env
 */

import { z } from 'zod';
import { frameworkEnvSchema, type FrameworkEnvConfig, parseFrameworkEnv } from '../framework.js';

// ============================================================================
// Re-exports from Framework
// ============================================================================

export type { FrameworkEnvConfig };
export { parseFrameworkEnv };

// ============================================================================
// Application Environment Schema
// ============================================================================

/**
 * Komodo application environment schema.
 *
 * Includes:
 * - Komodo server connection settings
 * - Authentication credentials
 * - API-specific configuration
 */
export const appEnvSchema = z.object({
  // --------------------------------------------------------------------------
  // Komodo Server Connection
  // --------------------------------------------------------------------------

  /** Komodo Server URL (optional, for auto-config) */
  KOMODO_URL: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .url()
        .refine((url) => url.startsWith('http://') || url.startsWith('https://'), {
          message: 'URL must start with http:// or https://',
        }),
    )
    .optional(),

  /** Komodo Username (optional, for auto-config with password) */
  KOMODO_USERNAME: z.string().min(1).optional(),

  /** Komodo Password (optional, for auto-config with username) */
  KOMODO_PASSWORD: z.string().min(1).optional(),

  /** Komodo API Key (optional, for auto-config with API key) */
  KOMODO_API_KEY: z.string().min(1).optional(),

  /** Komodo API Secret (optional, for auto-config with API key) */
  KOMODO_API_SECRET: z.string().min(1).optional(),

  // --------------------------------------------------------------------------
  // API Configuration
  // --------------------------------------------------------------------------

  /** API request timeout in milliseconds (default: 30000 = 30 seconds) */
  API_TIMEOUT_MS: z.coerce.number().min(1000).max(300000).default(30000),
});

/**
 * Application environment configuration type.
 */
export type AppEnvConfig = z.infer<typeof appEnvSchema>;

// ============================================================================
// Combined Schema
// ============================================================================

/**
 * Combined environment schema.
 * Merges framework-agnostic settings with application-specific settings.
 */
export const envSchema = frameworkEnvSchema.merge(appEnvSchema);

// ============================================================================
// Parsed Configuration
// ============================================================================

/**
 * Global configuration object parsed from environment variables.
 *
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
 */
function getEnv(key: string): string | undefined {
  const value = process.env[key];
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
