/**
 * Configuration Tools
 *
 * Tools for configuring the Komodo connection and checking health status.
 *
 * @module tools/config
 */

import { defineTool, text, z } from "mcp-server-framework";
import { SERVER_VERSION } from "../config/index.js";
import { KomodoClient, komodoConnectionManager, komodoConnectionMonitor } from "../client.js";

// ============================================================================
// Configure
// ============================================================================

export const configureTool = defineTool({
  name: "komodo_configure",
  description:
    "Configure connection to Komodo Core server. A valid connection MUST be established before using any other Komodo tools. Authenticates with username/password and establishes a session.",
  input: z.object({
    url: z.string().url().describe("Komodo Core server URL (e.g., http://localhost:9120)"),
    username: z.string().min(1).describe("Komodo username for authentication"),
    password: z.string().min(1).describe("Komodo password for authentication"),
  }),
  annotations: { idempotentHint: true },
  handler: async (args) => {
    try {
      const client = await KomodoClient.login(args.url, args.username, args.password);
      const success = await komodoConnectionManager.connect(client);

      if (success) {
        komodoConnectionMonitor.start({ url: args.url, username: args.username, password: args.password });
      }

      if (!success) {
        return text(
          `⚠️ Login successful, but health check failed.\n\n` +
            `🌐 Server: ${args.url}\n` +
            `👤 User: ${args.username}\n` +
            `\nPlease check your configuration!`,
        );
      }

      const health = await client.healthCheck();
      // @type-narrowing — healthCheck().details is Record<string, unknown>, narrowed to expected shape
      const details = health.details as { responseTime?: number; apiVersion?: string } | undefined;

      return text(
        `✅ Komodo Client successfully configured!\n\n` +
          `🌐 Server: ${args.url}\n` +
          `👤 User: ${args.username}\n` +
          (details?.responseTime != null ? `⚡ Response Time: ${details.responseTime}ms\n` : "") +
          `🔐 Authentication: OK\n` +
          (details?.apiVersion ? `📦 API Version: ${details.apiVersion}\n` : "") +
          `\nReady for container management! 🚀`,
      );
    } catch (error) {
      // Let typed errors (AuthenticationError, ConnectionError) pass through
      // so the framework preserves their clear, actionable messages.
      if (error instanceof Error && error.constructor !== Error) throw error;
      throw new Error(`Failed to configure Komodo client: ${error instanceof Error ? error.message : String(error)}`, {
        cause: error,
      });
    }
  },
});

// ============================================================================
// Health Check
// ============================================================================

interface KomodoHealthDetails {
  url: string;
  reachable: boolean;
  authenticated: boolean;
  responseTime: number;
  apiVersion?: string;
  error?: string;
}

function isKomodoHealthDetails(details: unknown): details is KomodoHealthDetails {
  return (
    typeof details === "object" &&
    details !== null &&
    "url" in details &&
    "reachable" in details &&
    "authenticated" in details &&
    "responseTime" in details
  );
}

export const healthCheckTool = defineTool({
  name: "komodo_health_check",
  description:
    "Check connection to Komodo Core server. Returns health status, response time, authentication status, and API version.",
  input: z.object({}),
  annotations: { readOnlyHint: true },
  handler: async () => {
    const client = komodoConnectionManager.getClient();

    if (!client) {
      return text(
        `⚠️ Komodo Client not configured\n\n` +
          `Please use 'komodo_configure' first to establish a connection.\n\n` +
          `Required parameters:\n` +
          `• url: Komodo server URL (e.g. http://localhost:9120)\n` +
          `• username: Your Komodo username\n` +
          `• password: Your Komodo password`,
      );
    }

    try {
      const health = await client.healthCheck();
      const details = isKomodoHealthDetails(health.details) ? health.details : null;

      if (health.status === "healthy" && details) {
        return text(
          `✅ Komodo server is reachable!\n\n` +
            `🌐 Server: ${details.url}\n` +
            `⚡ Response Time: ${details.responseTime}ms\n` +
            `🔐 Authentication: ${details.authenticated ? "✅ OK" : "❌ Failed"}\n` +
            (details.apiVersion ? `🦎 Komodo-API Version: ${details.apiVersion}\n` : "") +
            `📦 MCP Server Version: ${SERVER_VERSION}\n` +
            `\nStatus: ${health.message}`,
        );
      } else if (details) {
        return text(
          `❌ Komodo server health check failed!\n\n` +
            `🌐 Server: ${details.url}\n` +
            `📡 Reachable: ${details.reachable ? "✅ Yes" : "❌ No"}\n` +
            `🔐 Authenticated: ${details.authenticated ? "✅ Yes" : "❌ No"}\n` +
            `⏱️ Response Time: ${details.responseTime}ms\n\n` +
            `❗ Problem: ${health.message}\n` +
            (details.error ? `\n🔍 Details:\n${details.error}\n` : "") +
            `\n💡 Troubleshooting:\n` +
            (!details.reachable
              ? `• Server not reachable - check URL and network\n• Is the Komodo server running?\n• Check firewall settings\n`
              : "") +
            (details.reachable && !details.authenticated
              ? `• Authentication failed\n• Please login again with 'komodo_configure'\n• Check username and password\n`
              : ""),
        );
      } else {
        return text(
          health.status === "healthy"
            ? `✅ Server is healthy: ${health.message || "OK"}`
            : `❌ Health check failed: ${health.message || "Unknown error"}`,
        );
      }
    } catch (error) {
      return text(
        `❌ Health check error!\n\n` +
          `Unexpected error during health check:\n` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  },
});
