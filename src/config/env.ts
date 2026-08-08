/**
 * Application Configuration
 *
 * Two kinds of settings live here, both resolvable via environment variables AND the
 * config file (env wins, then file, then default):
 *  - **`KOMODO_*`** — the connection to Komodo Core (URL, credentials, API timeout).
 *  - **`MCP_*`** — this MCP server's own behavior that is app-specific (tool surface +
 *    destructive-action confirmation, secret redaction, ephemeral resource registry).
 *
 * Generic MCP-server settings (transport, sessions, logging, telemetry, and MCP-server
 * user authentication via the `[auth]` section) are owned by the framework and resolved
 * there — not here.
 *
 * @module config/env
 */

import { readFileSync } from "node:fs";
import {
  z,
  registerConfigSection,
  getAppConfig,
  getFrameworkConfig,
  durationSchema,
  booleanFromEnv,
  optionalBooleanFromEnv,
} from "mcp-server-framework";

// ============================================================================
// Environment Schema
// ============================================================================

/** Comma-separated env value → trimmed, non-empty string array (`undefined` when the var is unset). */
const csvList = () =>
  z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .optional();

export const appEnvSchema = z.object({
  // ── Komodo Core connection ────────────────────────────────────────────────

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

  /** Pre-existing JWT token (e.g. extracted from a Komodo browser session) */
  KOMODO_JWT_TOKEN: z.string().optional(),

  /** Path to file containing the username (Docker secrets) */
  KOMODO_USERNAME_FILE: z.string().optional(),

  /** Path to file containing the password (Docker secrets) */
  KOMODO_PASSWORD_FILE: z.string().optional(),

  /** Path to file containing the API key (Docker secrets) */
  KOMODO_API_KEY_FILE: z.string().optional(),

  /** Path to file containing the API secret (Docker secrets) */
  KOMODO_API_SECRET_FILE: z.string().optional(),

  /** Path to file containing the JWT token (Docker secrets) */
  KOMODO_JWT_TOKEN_FILE: z.string().optional(),

  /** Komodo API request timeout. Accepts human-readable durations ('30s', '1m') or plain milliseconds. Default: '30s' */
  KOMODO_API_TIMEOUT_MS: durationSchema("30s").pipe(z.number().int().positive()),

  // ── Ephemeral resource registry (MCP-server payload offloading) ────────────

  /** TTL for ephemeral info/inspect resources. Accepts durations ('15m') or ms. Default: '15m' */
  MCP_RESOURCE_TTL_INFO: durationSchema("15m").pipe(z.number().int().positive()),

  /** TTL for ephemeral log resources. Accepts durations ('2m') or ms. Default: '2m' */
  MCP_RESOURCE_TTL_LOGS: durationSchema("2m").pipe(z.number().int().positive()),

  /** Maximum number of dynamic resource entries kept in memory. Default: 1000 */
  MCP_RESOURCE_MAX_ENTRIES: z.coerce.number().int().positive().default(1000),

  // ── Destructive-action confirmation (MCP-server tool-execution safety) ─────

  /**
   * Require manual user confirmation (MCP elicitation) before destructive tools execute
   * (deletes, destroy, prune, exec, procedure/action/sync runs). Only the string "true"
   * enables, anything else disables. Default: true
   */
  MCP_CONFIRM_DESTRUCTIVE: booleanFromEnv(true),

  /**
   * What to do when the client cannot prompt (no elicitation capability or stateless mode):
   * "deny" refuses the destructive call, "allow" executes it with a warning. Default: "deny"
   */
  MCP_CONFIRM_FALLBACK: z.enum(["deny", "allow"]).default("deny"),

  /**
   * How long to wait for the user to answer a confirmation prompt before giving up.
   * Accepts a human-readable duration ("30s", "5m", "1h") or plain milliseconds. Default: 5m.
   * Env: MCP_CONFIRM_TIMEOUT_MS
   */
  MCP_CONFIRM_TIMEOUT_MS: durationSchema("5m").pipe(z.number().int().positive()),

  // ── Secret redaction (MCP-server output security) ──────────────────────────
  //
  // Layered on top of the framework's generic `MCP_SCRUB_*` settings: the
  // framework provides the BASE, these Komodo keys are the EXTENSION and win.
  // See `resolveScrubOptions()` in `src/index.ts` for the exact composition.

  /**
   * Master switch for secret redaction of tool output. Applied centrally by the
   * framework at the tool-result boundary and on offloaded-resource
   * registration (best-effort key-name + value-shape heuristics).
   *
   * Tri-state on purpose: when set it OVERRIDES the framework's
   * `MCP_SCRUB_ENABLED`; when unset that framework value applies, and if that is
   * unset too the default is on. Only the string "true" is truthy.
   */
  MCP_SECRET_SCRUB_ENABLED: optionalBooleanFromEnv(),

  /**
   * Comma-separated extra key-name fragments always redacted (case-insensitive).
   * Unioned with the framework's `MCP_SCRUB_ADDITIONAL_KEYS`.
   */
  MCP_SECRET_SCRUB_KEYS: csvList(),

  /**
   * Comma-separated exact key names never redacted by key-based matching
   * (case-insensitive), merged with the built-in Komodo allowlist
   * (`public_key`, `is_secret`, …) and the framework's `MCP_SCRUB_ALLOW_KEYS`.
   */
  MCP_SECRET_SCRUB_ALLOW_KEYS: csvList(),

  // ── Tool-surface control (MCP-server context/token pruning) ────────────────

  /**
   * Operator tool-surface control — prune which tools are registered to shrink the
   * client's context/token load. Purely subtractive: these only *remove* tools from
   * `tools/list` (and make them uncallable); they never expose more, and never bypass
   * the security scope-gating (read-only anonymous mode still applies to what remains).
   *
   * Category values are the `_meta.category` strings in `src/config/categories.ts`
   * (e.g. `server`, `stack`, `deployment`, `terminal`, `resource_sync`).
   */

  /** Comma-separated category allowlist. Unset/empty ⇒ all categories allowed. */
  MCP_TOOLS_ALLOWED_CATEGORIES: csvList(),

  /** Comma-separated categories to remove entirely. */
  MCP_TOOLS_EXCLUDED_CATEGORIES: csvList(),

  /** Comma-separated individual tool names to remove (e.g. `komodo_exec`). */
  MCP_TOOLS_EXCLUDED_TOOLS: csvList(),
});

export type AppEnvConfig = z.infer<typeof appEnvSchema>;

// ============================================================================
// Resolved Config (env > file > default)
// ============================================================================

/**
 * Effective configuration. Populated env-only at import time, then re-resolved by
 * {@link resolveKomodoConfig} once the config file has loaded — mutated **in place** so
 * every importer keeps a stable reference. Read `config.MCP_*` / `config.KOMODO_*` anywhere.
 */
export const config: AppEnvConfig = appEnvSchema.parse(process.env);

/**
 * Merge the app-specific config-file sections and re-resolve {@link config} as
 * **env > file > default**: file values become env-style string overrides that the env
 * schema parses, and `process.env` is spread last so a real env var always wins.
 *
 * Must be called AFTER the config file is loaded and BEFORE any consumer reads a file-backed
 * knob (`scrubOptions`, the resource registry, the tool filter in `src/index.ts`).
 */
export function resolveKomodoConfig(): void {
  getFrameworkConfig(); // ensure the config file is loaded so getAppConfig() has section data
  Object.assign(config, appEnvSchema.parse({ ...fileSectionOverrides(), ...process.env }));
}

/** Map the registered app config-file sections to env-style string overrides (only for present keys). */
function fileSectionOverrides(): Record<string, string> {
  const komodo = getAppConfig<KomodoFileConfig>("komodo");
  const tools = getAppConfig<ToolsFileConfig>("tools");
  const redaction = getAppConfig<RedactionFileConfig>("redaction");
  const resources = getAppConfig<ResourcesFileConfig>("resources");

  const overrides: Record<string, string> = {};
  const put = (envKey: string, value: string | number | boolean | readonly string[] | undefined): void => {
    if (value === undefined) return;
    overrides[envKey] = Array.isArray(value) ? value.join(",") : String(value);
  };

  put("KOMODO_API_TIMEOUT_MS", komodo?.api_timeout_ms);
  put("MCP_TOOLS_ALLOWED_CATEGORIES", tools?.allowed_categories);
  put("MCP_TOOLS_EXCLUDED_CATEGORIES", tools?.excluded_categories);
  put("MCP_TOOLS_EXCLUDED_TOOLS", tools?.excluded_tools);
  put("MCP_CONFIRM_DESTRUCTIVE", tools?.confirm_destructive);
  put("MCP_CONFIRM_FALLBACK", tools?.confirm_fallback);
  put("MCP_CONFIRM_TIMEOUT_MS", tools?.confirm_timeout);
  put("MCP_SECRET_SCRUB_ENABLED", redaction?.enabled);
  put("MCP_SECRET_SCRUB_KEYS", redaction?.keys);
  put("MCP_SECRET_SCRUB_ALLOW_KEYS", redaction?.allow_keys);
  put("MCP_RESOURCE_TTL_INFO", resources?.ttl_info);
  put("MCP_RESOURCE_TTL_LOGS", resources?.ttl_logs);
  put("MCP_RESOURCE_MAX_ENTRIES", resources?.max_entries);
  return overrides;
}

// ============================================================================
// Runtime Credential Reader
// ============================================================================

/**
 * Global Komodo connection credentials (the service-account fallback used in stdio /
 * auth-disabled mode). Per-user sessions never use these — they connect with the user's
 * own minted JWT.
 */
export interface KomodoCredentials {
  url?: string | undefined;
  username?: string | undefined;
  password?: string | undefined;
  apiKey?: string | undefined;
  apiSecret?: string | undefined;
  jwtToken?: string | undefined;
}

/**
 * Read a secret value from a file path (Docker secrets pattern).
 * Returns undefined if the path is not set or the file cannot be read.
 */
function readSecretFile(filePath: string | undefined): string | undefined {
  if (!filePath) return undefined;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Docker secrets: path from trusted env var
    return readFileSync(filePath, "utf-8").trim();
  } catch {
    return undefined;
  }
}

/**
 * Read the global Komodo connection credentials at runtime.
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
    username: process.env["KOMODO_USERNAME"] ?? readSecretFile(process.env["KOMODO_USERNAME_FILE"]) ?? file?.username,
    password: process.env["KOMODO_PASSWORD"] ?? readSecretFile(process.env["KOMODO_PASSWORD_FILE"]) ?? file?.password,
    apiKey: process.env["KOMODO_API_KEY"] ?? readSecretFile(process.env["KOMODO_API_KEY_FILE"]) ?? file?.api_key,
    apiSecret:
      process.env["KOMODO_API_SECRET"] ?? readSecretFile(process.env["KOMODO_API_SECRET_FILE"]) ?? file?.api_secret,
    jwtToken:
      process.env["KOMODO_JWT_TOKEN"] ?? readSecretFile(process.env["KOMODO_JWT_TOKEN_FILE"]) ?? file?.jwt_token,
  };
}

// ============================================================================
// Config File Sections
// ============================================================================

/** `[komodo]` — Komodo Core connection (credentials belong in the environment, not the file). */
const komodoConfigFileSchema = z.object({
  /** Komodo Core API URL */
  url: z.string().url().optional(),
  /** Username for login authentication */
  username: z.string().optional(),
  /** Path to file containing the username (Docker secrets) */
  username_file: z.string().optional(),
  /** Password for login authentication */
  password: z.string().optional(),
  /** Path to file containing the password (Docker secrets) */
  password_file: z.string().optional(),
  /** API Key for key-based authentication */
  api_key: z.string().optional(),
  /** Path to file containing the API key (Docker secrets) */
  api_key_file: z.string().optional(),
  /** API Secret for key-based authentication */
  api_secret: z.string().optional(),
  /** Path to file containing the API secret (Docker secrets) */
  api_secret_file: z.string().optional(),
  /** Pre-existing JWT token */
  jwt_token: z.string().optional(),
  /** Path to file containing the JWT token (Docker secrets) */
  jwt_token_file: z.string().optional(),
  /** Komodo API request timeout as duration ('30s', '1m') or milliseconds (number). Env: KOMODO_API_TIMEOUT_MS */
  api_timeout_ms: z.union([z.number().int().positive(), z.string()]).optional(),
});

/** `[tools]` — tool surface + destructive-action confirmation (env `MCP_TOOLS_*` / `MCP_CONFIRM_*`). */
const toolsConfigFileSchema = z.object({
  /** Category allowlist. Unset/empty ⇒ all allowed. Env: MCP_TOOLS_ALLOWED_CATEGORIES */
  allowed_categories: z.array(z.string()).optional(),
  /** Categories to remove entirely. Env: MCP_TOOLS_EXCLUDED_CATEGORIES */
  excluded_categories: z.array(z.string()).optional(),
  /** Individual tool names to remove. Env: MCP_TOOLS_EXCLUDED_TOOLS */
  excluded_tools: z.array(z.string()).optional(),
  /** Require manual confirmation before destructive tools execute. Env: MCP_CONFIRM_DESTRUCTIVE */
  confirm_destructive: z.boolean().optional(),
  /** Behavior when a client cannot prompt: "deny" or "allow". Env: MCP_CONFIRM_FALLBACK */
  confirm_fallback: z.enum(["deny", "allow"]).optional(),
  /** How long to wait for a confirmation answer as duration ('5m', '30s') or ms. Env: MCP_CONFIRM_TIMEOUT_MS */
  confirm_timeout: z.union([z.number().int().positive(), z.string()]).optional(),
});

/** `[redaction]` — secret redaction of tool output (env `MCP_SECRET_SCRUB_*`). */
const redactionConfigFileSchema = z.object({
  /** Master switch for secret redaction. Env: MCP_SECRET_SCRUB_ENABLED */
  enabled: z.boolean().optional(),
  /** Extra key-name fragments always redacted. Env: MCP_SECRET_SCRUB_KEYS */
  keys: z.array(z.string()).optional(),
  /** Exact key names never redacted by key-matching. Env: MCP_SECRET_SCRUB_ALLOW_KEYS */
  allow_keys: z.array(z.string()).optional(),
});

/** `[resources]` — ephemeral resource registry for offloaded payloads (env `MCP_RESOURCE_*`). */
const resourcesConfigFileSchema = z.object({
  /** TTL for info/inspect resources as duration ('15m') or ms. Env: MCP_RESOURCE_TTL_INFO */
  ttl_info: z.union([z.number().int().positive(), z.string()]).optional(),
  /** TTL for log resources as duration ('2m') or ms. Env: MCP_RESOURCE_TTL_LOGS */
  ttl_logs: z.union([z.number().int().positive(), z.string()]).optional(),
  /** Maximum ephemeral entries kept in memory. Env: MCP_RESOURCE_MAX_ENTRIES */
  max_entries: z.number().int().positive().optional(),
});

export type KomodoFileConfig = z.infer<typeof komodoConfigFileSchema>;
type ToolsFileConfig = z.infer<typeof toolsConfigFileSchema>;
type RedactionFileConfig = z.infer<typeof redactionConfigFileSchema>;
type ResourcesFileConfig = z.infer<typeof resourcesConfigFileSchema>;

/**
 * Register all app config-file sections with the framework.
 *
 * Must be called **before** config initialization (the first `getFrameworkConfig()` /
 * `createServer()`), then {@link resolveKomodoConfig} merges the parsed sections into `config`.
 */
export function registerKomodoConfigSection(): void {
  registerConfigSection("komodo", komodoConfigFileSchema);
  registerConfigSection("tools", toolsConfigFileSchema);
  registerConfigSection("redaction", redactionConfigFileSchema);
  registerConfigSection("resources", resourcesConfigFileSchema);
}
