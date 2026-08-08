#!/usr/bin/env node
/**
 * Komodo MCP Server — Entry Point
 *
 * Creates and starts the MCP server with all Komodo tools auto-registered.
 */

// Must be first import — polyfills localStorage for mogh_auth_client (Node.js)
import "./utils/polyfills.js";

import {
  createServer,
  createOAuthProvider,
  logger,
  logAuditEvent,
  getFrameworkConfig,
  deriveServerBaseUrl,
  resolveAuthConfig,
  configureDynamicResourceRegistry,
  configureLoggerFromEnv,
  defineDynamicResourceTemplate,
  iconFromFile,
} from "mcp-server-framework";
import type { AuthOptions, LocalLoginConfig, ScrubToolResultsConfig, ToolDefinition } from "mcp-server-framework";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  SERVER_NAME,
  SERVER_VERSION,
  registerKomodoConfigSection,
  config,
  getKomodoCredentials,
  resolveKomodoConfig,
  ToolScopes,
  ToolCategories,
} from "./config/index.js";
import { configureKomodoConnections, stopKomodoConnections, resolveAuth, KomodoClient } from "./client.js";
import { AuthenticationError } from "./errors/index.js";
import { buildKomodoContext, komodoAuthInfo } from "./auth/komodo-identity.js";
import { komodoLoginPage } from "./auth/login.js";
import { resolveScrubOptions } from "./utils/redact.js";

// Side-effect imports — register all tools in the global registry
import "./tools/index.js";

// MCP server icon — read once at startup relative to this compiled module's own
// location (mirrors resolveVersion()'s import.meta.url pattern), so it resolves
// correctly both locally and in the Docker image, where only build/ exists.
const komodoIcon = iconFromFile(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "auth/assets/favicon.svg"),
  "image/svg+xml",
);

// Register [komodo] config file section before server init
registerKomodoConfigSection();

// Apply the logger config up front so bootstrap logging (auth setup, resource
// registry) is formatted consistently — createServer() reapplies it later. Without
// this, anything logged before createServer() uses the bare default format.
configureLoggerFromEnv({ name: SERVER_NAME, version: SERVER_VERSION });

// Resolve config as env > file > default now that the sections are registered. MUST run
// before any file-backed knob is read below (scrubOptions, resource registry, tool filter).
resolveKomodoConfig();

// Central secret redaction (issue #160): one POLICY (utils/redact.ts), one
// framework implementation, applied at every choke point — the tool-result
// boundary (createServer.scrubToolResults), offloaded-resource registration
// (DynamicResourceRegistry.scrub), and forwarded log notifications.
// Composed as framework base (MCP_SCRUB_*) ← Komodo extension (MCP_SECRET_SCRUB_*);
// resolved ONCE here so both choke points below get byte-identical policy.
const scrubOptions: ScrubToolResultsConfig = resolveScrubOptions();

// Configure ephemeral resource registry and register the canonical template
configureDynamicResourceRegistry({
  uriScheme: "ephemeral",
  maxEntries: config.MCP_RESOURCE_MAX_ENTRIES,
  scrub: scrubOptions,
});
defineDynamicResourceTemplate();

// ============================================================================
// MCP authentication resolution (operating-mode aware)
// ============================================================================

// OAuth applies only to HTTP transports; stdio has no HTTP layer to authenticate against
// and always runs anonymously against the global Komodo connection.
const transportMode = getFrameworkConfig().MCP_TRANSPORT;
const httpMode = transportMode !== "stdio";

// deriveServerBaseUrl() triggers framework config init (reads config.toml) and MUST run
// before getKomodoCredentials() so config.toml values are available.
const mcpServerUrl = deriveServerBaseUrl();

const startupCreds = getKomodoCredentials();
const komodoUrl = startupCreds.url;
// defaultEnabled:true — unlike the framework's generic default (auth on only when an
// OAuth provider is configured), Komodo always offers local username/password login
// whenever KOMODO_URL is set, so "zero providers" doesn't mean "no way to log in".
// Auth defaults ON; set MCP_AUTH_ENABLED=false or [auth].enabled=false to opt out.
// NOTE: external OAuth providers ([auth.providers.*]) are not wired in yet — only local
// Komodo username/password login is offered until that lands (see feat/oauth-login).
const authResolved = resolveAuthConfig({ defaultEnabled: true }); // master switch
const authActive = httpMode && authResolved.enabled;

/** Fail-closed provider: server starts but every /mcp request is rejected (no token verifies). */
const denyAllAuth: AuthOptions = {
  enabled: true,
  provider: {
    verifyAccessToken: () => Promise.reject(new Error("authentication is unavailable (server misconfigured)")),
  },
};

let authConfig: AuthOptions | undefined;

if (authActive) {
  if (!komodoUrl) {
    logger.error(
      "SECURITY: authentication is enabled but KOMODO_URL is not configured — failing closed (all requests rejected)",
    );
    logAuditEvent({
      category: "config",
      action: "auth_misconfigured",
      outcome: "denied",
      detail: { reason: "missing_komodo_url" },
    });
    authConfig = denyAllAuth;
  } else {
    const url = komodoUrl;
    try {
      // Local username/password login against Komodo — always offered on the unified login
      // page when auth is active, yielding an isolated per-user session. External OAuth
      // providers (GitHub/Google/OIDC) are not wired in yet — see feat/oauth-login.
      const localLogin: LocalLoginConfig = {
        displayName: "Komodo username & password",
        verify: async (username, password) => {
          try {
            const jwt = await KomodoClient.loginForJwt(url, username, password);
            return komodoAuthInfo(await buildKomodoContext(url, jwt, "local"), jwt);
          } catch (err) {
            if (err instanceof AuthenticationError) return null; // bad credentials / disabled → reject
            throw err; // unexpected (e.g. Komodo unreachable) → surfaced as a server error
          }
        },
      };

      const { provider, callbackHandler, localLoginHandler } = await createOAuthProvider([], {
        serverUrl: mcpServerUrl,
        localLogin,
        renderLoginPage: komodoLoginPage,
      });

      authConfig = {
        enabled: true,
        provider,
        callbackHandler,
        ...(localLoginHandler && { localLoginHandler }),
        issuerUrl: new URL(mcpServerUrl),
      };

      logger.info("MCP authentication enabled — local login");
    } catch (err) {
      logger.error(
        "SECURITY: OAuth provider initialization failed — failing closed (all requests rejected): %s",
        err instanceof Error ? err.message : String(err),
      );
      logAuditEvent({
        category: "config",
        action: "auth_init_failed",
        outcome: "denied",
        detail: { error: err instanceof Error ? err.message : String(err) },
      });
      authConfig = denyAllAuth;
    }
  }
}

// ============================================================================
// Server Instance
// ============================================================================

// Anonymous mode (stdio, or HTTP with auth disabled) serves via the global Komodo
// connection; authenticated HTTP resolves a per-user client from each request's JWT.
const anonymousMode = !authConfig;

// Open network deployment (http OR https, no per-user auth) ⇒ READ-ONLY, as an invariant.
// Anonymous requests are granted only the READ scope, so the framework hides and rejects
// every write/operate/exec/delete tool (komodo:operate / komodo:admin). This bounds the blast
// radius of a misconfigured open server to reads; the only way to get write access over the
// network is to enable [auth]. stdio (httpMode === false) is local & trusted ⇒ unrestricted.
const anonymousScopes = httpMode && anonymousMode ? [ToolScopes.READ] : undefined;

// Security notice: an open network server backed by shared global credentials is now read-only.
// Not applicable to stdio (one local user).
if (anonymousScopes && resolveAuth(startupCreds) !== null) {
  logger.warn(
    "SECURITY: MCP authentication is disabled — this %s server is READ-ONLY. Write, exec and delete tools are " +
      "hidden and rejected for anonymous callers; reads act as the shared global identity. Enable [auth] for " +
      "per-user write access.",
    transportMode,
  );
  logAuditEvent({
    category: "config",
    action: "restricted_anonymous",
    outcome: "info",
    detail: { transport: transportMode, grantedScopes: [ToolScopes.READ] },
  });
}

// ============================================================================
// Operator tool-surface filter (context/token pruning)
// ============================================================================

// Purely SUBTRACTIVE: these only remove tools from registration (absent from tools/list,
// not callable). They never expose more and never bypass the security scope-gating above —
// read-only anonymous mode still applies to whatever tools remain. Category values are the
// `_meta.category` strings in config/categories.ts.
const knownCategories = new Set<string>(Object.values(ToolCategories));

/** Drop unknown category names (typo protection) with a clear warning, keep the valid ones. */
function validateCategories(raw: readonly string[] | undefined, varName: string): Set<string> {
  const set = new Set(raw);
  const unknown = [...set].filter((c) => !knownCategories.has(c));
  if (unknown.length > 0) {
    logger.warn(
      "Ignoring unknown categories in %s: %s — valid categories: %s",
      varName,
      unknown.join(", "),
      [...knownCategories].join(", "),
    );
    for (const c of unknown) set.delete(c);
  }
  return set;
}

const allowedCategories = validateCategories(config.MCP_TOOLS_ALLOWED_CATEGORIES, "MCP_TOOLS_ALLOWED_CATEGORIES");
const excludedCategories = validateCategories(config.MCP_TOOLS_EXCLUDED_CATEGORIES, "MCP_TOOLS_EXCLUDED_CATEGORIES");
const excludedTools = new Set(config.MCP_TOOLS_EXCLUDED_TOOLS); // tool-name typos fail safe (tool simply stays)

const toolFilterActive = allowedCategories.size + excludedCategories.size + excludedTools.size > 0;

// Tool-name typos in MCP_TOOLS_EXCLUDED_TOOLS are harmless (nothing removed); a category
// allowlist keeps only tools in the listed categories, then category/tool excludes remove more.
const filterTools = toolFilterActive
  ? (tool: ToolDefinition): boolean => {
      const cat = tool._meta?.category as string | undefined;
      if (allowedCategories.size > 0 && !(cat != null && allowedCategories.has(cat))) return false;
      if (excludedTools.has(tool.name)) return false;
      return !(cat != null && excludedCategories.has(cat));
    }
  : undefined;

if (toolFilterActive) {
  logAuditEvent({
    category: "config",
    action: "tool_surface_filtered",
    outcome: "info",
    detail: {
      allowedCategories: [...allowedCategories],
      excludedCategories: [...excludedCategories],
      excludedTools: [...excludedTools],
    },
  });
}

const { start } = createServer({
  name: SERVER_NAME,
  version: SERVER_VERSION,
  title: "Komodo MCP Server",
  icons: [komodoIcon],

  capabilities: {
    tools: { listChanged: true },
    logging: true,
  },

  // Central tool-result secret redaction (issue #160) — same config as the
  // dynamic-resource registry above.
  scrubToolResults: scrubOptions,

  // Open network deployment ⇒ read-only: anonymous callers get only the READ scope,
  // so operate/exec/delete tools are hidden from tools/list and rejected on call.
  ...(anonymousScopes && { anonymousScopes }),

  // Operator tool-surface pruning (context/token) — subtractive, never bypasses scope gating.
  ...(filterTools && { filterTools }),

  ...(authConfig && { auth: authConfig }),

  lifecycle: {
    onStarting: () => configureKomodoConnections({ anonymousMode }),
    onStopping: () => {
      stopKomodoConnections();
    },
  },

  health: {
    readinessCheck: () => true,
    serviceLabel: "komodo",
  },

  shutdown: {
    timeoutMs: 10_000,
    forceExitOnTimeout: true,
    signals: ["SIGINT", "SIGTERM"],
  },
});

// ============================================================================
// Start
// ============================================================================

start().catch((error: unknown) => {
  logger.error("Failed to start Komodo MCP Server: %s", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
