/**
 * Configuration & Health Tools
 *
 * Entry-point tools for establishing and verifying the Komodo connection.
 * A valid connection via `komodo_configure` is required before any other tools work.
 *
 * @module tools/config
 */

import { defineTool, error, text, z } from "mcp-server-framework";
import { logger as baseLogger } from "mcp-server-framework";
import { SERVER_VERSION, RESPONSE_ICONS } from "../config/index.js";
import { KomodoClient, komodoConnection, resolveAuth } from "../client.js";
import { AuthenticationError } from "../errors/index.js";

const logger = baseLogger.child({ component: "config-tools" });

// ============================================================================
// Auth Method Labels
// ============================================================================

/** Human-readable labels for auth strategy method identifiers */
const AUTH_METHOD_LABELS: Record<string, string> = {
  "api-key": "API Key",
  jwt: "JWT Token",
  password: "Username/Password",
};

function getAuthLabel(method: string): string {
  return AUTH_METHOD_LABELS[method] ?? method;
}

// ============================================================================
// Login Options Helper
// ============================================================================

/**
 * Query available login options from the Komodo server.
 * Returns formatted string or `null` on failure (non-critical).
 */
async function queryLoginOptions(url: string): Promise<string | null> {
  try {
    const options = await KomodoClient.getLoginOptions(url);
    const methods = [
      options.local && "Local",
      options.github && "GitHub",
      options.google && "Google",
      options.oidc && "OIDC",
    ].filter(Boolean);
    return methods.length > 0 ? methods.join(", ") : null;
  } catch (error) {
    logger.trace(
      "Could not query login options from %s: %s",
      url,
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

// ============================================================================
// Configure
// ============================================================================

const configureInput = z.object({
  url: z.string().url().describe("Komodo Core server URL (e.g., http://host.docker.internal:9120)"),
  username: z.string().min(1).describe("Komodo username (for password auth)").optional(),
  password: z.string().min(1).describe("Komodo password (for password auth)").optional(),
  apiKey: z.string().min(1).describe("Komodo API key (for API-key auth)").optional(),
  apiSecret: z.string().min(1).describe("Komodo API secret (for API-key auth)").optional(),
  jwtToken: z.string().min(1).describe("Komodo JWT token (for JWT auth)").optional(),
});

export const configureTool = defineTool({
  name: "komodo_configure",
  description:
    "Configure connection to Komodo Core server. Required before using any other Komodo tools. " +
    "Supports three auth methods: username+password (local login), apiKey+apiSecret, or jwtToken.",
  input: configureInput,
  annotations: { idempotentHint: true },
  handler: async (args) => {
    // Validate auth method selection (was .refine(), moved here so zodToJsonSchema sees the fields)
    const methods = [!!(args.username || args.password), !!(args.apiKey || args.apiSecret), !!args.jwtToken].filter(
      Boolean,
    ).length;
    if (methods > 1) {
      logger.warn("Configuration rejected: multiple auth methods provided");
      return error("Provide only one authentication method: username+password, apiKey+apiSecret, or jwtToken");
    }

    const auth = resolveAuth(args);
    if (!auth) {
      logger.warn("Configuration rejected: no auth method provided");
      return error("Provide one authentication method: username+password, apiKey+apiSecret, or jwtToken");
    }

    const authLabel = getAuthLabel(auth.method);
    logger.debug("Configuring Komodo connection to %s via %s", args.url, authLabel);

    // Query available login options (informational, non-critical)
    const loginMethods = await queryLoginOptions(args.url);

    // Connect: ping → authenticate → health check → start monitoring
    // Throws ConnectionError (unreachable) or AuthenticationError (bad credentials)
    // — both propagate with clear messages and recovery hints.
    const { success, version, error: healthError } = await komodoConnection.connect(auth, args.url);

    if (!success) {
      logger.warn("Connected to %s but health check failed: %s", args.url, healthError ?? "unknown");
      return text(
        `${RESPONSE_ICONS.WARNING} Connected but health check failed\n\n` +
          `${RESPONSE_ICONS.NETWORK} Server: ${args.url}\n` +
          `${RESPONSE_ICONS.AUTH} Auth: ${authLabel}\n` +
          (healthError ? `${RESPONSE_ICONS.ERROR} Error: ${healthError}\n` : "") +
          `\nAuthentication succeeded but the health check did not pass.\n` +
          `Other tools may not work correctly until the server is fully operational.`,
      );
    }

    logger.info("Komodo connection configured: %s via %s", args.url, authLabel);

    const lines = [
      `${RESPONSE_ICONS.SUCCESS} Komodo connection established`,
      "",
      `${RESPONSE_ICONS.NETWORK} Server: ${args.url}`,
      `${RESPONSE_ICONS.AUTH} Auth: ${authLabel}`,
    ];
    if (version) lines.push(`${RESPONSE_ICONS.KOMODO} Komodo: v${version}`);
    if (loginMethods) lines.push(`${RESPONSE_ICONS.LIST} Login Methods: ${loginMethods}`);
    lines.push("", "Ready for container management.");

    return text(lines.join("\n"));
  },
});

// ============================================================================
// Health Check
// ============================================================================

export const healthCheckTool = defineTool({
  name: "komodo_health_check",
  description:
    "Check the Komodo connection status. Returns health, authentication status, and API version. " +
    "Works without an active connection (reports unconfigured state).",
  input: z.object({}),
  annotations: { readOnlyHint: true },
  handler: async () => {
    const client = komodoConnection.getClient();

    if (!client) {
      return text(
        `${RESPONSE_ICONS.WARNING} Komodo client is not configured\n\n` +
          `Use 'komodo_configure' to establish a connection.\n\n` +
          `Authentication methods:\n` +
          `• username + password — Local account login\n` +
          `• apiKey + apiSecret — API key authentication\n` +
          `• jwtToken — JWT token authentication`,
      );
    }

    try {
      const health = await client.healthCheck();

      if (health.healthy) {
        const lines = [
          `${RESPONSE_ICONS.SUCCESS} Komodo server is healthy`,
          "",
          `${RESPONSE_ICONS.NETWORK} Server: ${client.url}`,
          `${RESPONSE_ICONS.AUTH} Authentication: OK`,
        ];
        if (health.version) lines.push(`${RESPONSE_ICONS.KOMODO} Komodo: v${health.version}`);
        lines.push(`${RESPONSE_ICONS.VERSION} MCP Server: v${SERVER_VERSION}`);

        return text(lines.join("\n"));
      }

      logger.warn("Health check failed for %s: %s", client.url, health.error);
      return text(
        `${RESPONSE_ICONS.ERROR} Health check failed\n\n` +
          `${RESPONSE_ICONS.NETWORK} Server: ${client.url}\n` +
          (health.error ? `${RESPONSE_ICONS.WARNING} ${health.error}\n` : "") +
          `\nTroubleshooting:\n` +
          `• Check if the Komodo server is running\n` +
          `• Verify network connectivity\n` +
          `• Try reconnecting with 'komodo_configure'`,
      );
    } catch (error) {
      // AuthenticationError (401/403) — propagate with clear message + recovery hint
      if (error instanceof AuthenticationError) throw error;

      logger.warn("Health check error for %s: %s", client.url, error instanceof Error ? error.message : String(error));
      return text(
        `${RESPONSE_ICONS.ERROR} Health check error\n\n` +
          `${RESPONSE_ICONS.NETWORK} Server: ${client.url}\n` +
          `${RESPONSE_ICONS.WARNING} ${error instanceof Error ? error.message : String(error)}\n\n` +
          `Try reconnecting with 'komodo_configure'.`,
      );
    }
  },
});
