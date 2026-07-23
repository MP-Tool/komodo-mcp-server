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
import type { AuthOptions, LocalLoginConfig, ScrubToolResultsConfig } from "mcp-server-framework";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  SERVER_NAME,
  SERVER_VERSION,
  registerKomodoConfigSection,
  config,
  getKomodoCredentials,
} from "./config/index.js";
import { configureKomodoConnections, stopKomodoConnections, resolveAuth, KomodoClient } from "./client.js";
import { AuthenticationError } from "./errors/index.js";
import { buildKomodoContext, komodoAuthInfo } from "./auth/komodo-identity.js";
import { komodoLoginPage } from "./auth/login.js";
import { KOMODO_SCRUB_ALLOW_KEYS, KOMODO_SCRUB_RULES } from "./utils/redact.js";

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

// Central secret redaction (issue #160): one POLICY (utils/redact.ts), one
// framework implementation, applied at every choke point — the tool-result
// boundary (createServer.scrubToolResults), offloaded-resource registration
// (DynamicResourceRegistry.scrub), and forwarded log notifications.
const scrubOptions: ScrubToolResultsConfig = config.KOMODO_SECRET_SCRUB_ENABLED
  ? {
      ...KOMODO_SCRUB_RULES,
      additionalKeys: config.KOMODO_SECRET_SCRUB_KEYS ?? [],
      allowKeys: [...KOMODO_SCRUB_ALLOW_KEYS, ...(config.KOMODO_SECRET_SCRUB_ALLOW_KEYS ?? [])],
    }
  : false;

// Configure ephemeral resource registry and register the canonical template
configureDynamicResourceRegistry({
  uriScheme: "ephemeral",
  maxEntries: config.KOMODO_RESOURCE_MAX_ENTRIES,
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

// Security warning: an open HTTP server backed by shared global credentials means anyone who
// can reach it acts as that single Komodo identity. Not applicable to stdio (one local user).
if (httpMode && anonymousMode && resolveAuth(startupCreds) !== null) {
  logger.warn(
    "SECURITY: MCP authentication is disabled but global Komodo credentials are configured — the server is " +
      "OPEN and every request acts as the shared global identity. Enable [auth] for per-user isolation.",
  );
  logAuditEvent({
    category: "config",
    action: "insecure_global_login",
    outcome: "info",
    detail: { transport: transportMode },
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
