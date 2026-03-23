/**
 * Application Environment Configuration
 *
 * Komodo-specific environment variables only.
 * Framework variables (MCP_TRANSPORT, MCP_PORT, etc.) are handled by the framework.
 *
 * @module config/env
 */

import { readFileSync } from "node:fs";
import { z, registerConfigSection, getAppConfig } from "mcp-server-framework";

// ============================================================================
// Schema
// ============================================================================

export const appEnvSchema = z.object({
  /** Komodo Core API URL */
  KOMODO_URL: z.string().url().optional(),

  /** Username for login authentication */
  KOMODO_USERNAME: z.string().optional(),

  /** Password for login authentication */
  KOMODO_PASSWORD: z.string().optional(),

  /** API Key for key-based authentication */
  KOMODO_API_KEY: z.string().optional(),

  /** API Secret for key-based authentication */
  KOMODO_API_SECRET: z.string().optional(),

  /** Path to file containing the password (Docker secrets) */
  KOMODO_PASSWORD_FILE: z.string().optional(),

  /** Path to file containing the API key (Docker secrets) */
  KOMODO_API_KEY_FILE: z.string().optional(),

  /** Path to file containing the API secret (Docker secrets) */
  KOMODO_API_SECRET_FILE: z.string().optional(),

  /** API request timeout in milliseconds */
  API_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

export type AppEnvConfig = z.infer<typeof appEnvSchema>;

// ============================================================================
// Parsed Config (once at startup)
// ============================================================================

export const config = appEnvSchema.parse(process.env);

// ============================================================================
// Runtime Credential Reader
// ============================================================================

export interface KomodoCredentials {
  url?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
}

/**
 * Read a secret value from a file path (Docker secrets pattern).
 * Returns undefined if the path is not set or the file cannot be read.
 */
function readSecretFile(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  try {
    return readFileSync(filePath, "utf-8").trim();
  } catch {
    return undefined;
  }
}

/**
 * Read Komodo credentials at runtime.
 *
 * Sources (highest priority wins):
 * 1. Environment variables (process.env)
 * 2. Docker secret files (*_FILE env vars)
 * 3. Config file `[komodo]` section (via framework config system)
 *
 * Important for Docker containers where env_file variables
 * are only available after container start.
 */
export function getKomodoCredentials(): KomodoCredentials {
  const file = getAppConfig<KomodoFileConfig>("komodo");

  return {
    url: process.env["KOMODO_URL"] ?? file?.url,
    username: process.env["KOMODO_USERNAME"] ?? file?.username,
    password: process.env["KOMODO_PASSWORD"] ?? readSecretFile(process.env["KOMODO_PASSWORD_FILE"]) ?? file?.password,
    apiKey: process.env["KOMODO_API_KEY"] ?? readSecretFile(process.env["KOMODO_API_KEY_FILE"]) ?? file?.api_key,
    apiSecret:
      process.env["KOMODO_API_SECRET"] ?? readSecretFile(process.env["KOMODO_API_SECRET_FILE"]) ?? file?.api_secret,
  };
}

// ============================================================================
// Config File Section
// ============================================================================

/** Schema for the `[komodo]` section in config files (config.toml/yaml/json) */
const komodoConfigFileSchema = z.object({
  /** Komodo Core API URL */
  url: z.string().url().optional(),
  /** Username for login authentication */
  username: z.string().optional(),
  /** Password for login authentication */
  password: z.string().optional(),
  /** API Key for key-based authentication */
  api_key: z.string().optional(),
  /** API Secret for key-based authentication */
  api_secret: z.string().optional(),
  /** API request timeout in milliseconds */
  api_timeout_ms: z.number().int().positive().optional(),
});

export type KomodoFileConfig = z.infer<typeof komodoConfigFileSchema>;

/**
 * Register the `[komodo]` config file section with the framework.
 *
 * Must be called **before** `createServer()` (which triggers config initialization).
 */
export function registerKomodoConfigSection(): void {
  registerConfigSection("komodo", komodoConfigFileSchema);
}
