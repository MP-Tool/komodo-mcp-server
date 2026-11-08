/**
 * Health Check Tool
 *
 * Reports the status of the Komodo connection. The connection itself is established
 * from startup config (`[komodo]` in config.toml / `KOMODO_*` env vars, anonymous
 * mode only) or from each user's own OAuth login — never from an in-chat tool call.
 *
 * @module tools/config
 */

import { defineTool, FRAMEWORK_VERSION, structured, z } from "mcp-server-framework";
import { logger as baseLogger } from "mcp-server-framework";
import { SERVER_VERSION, ToolCategories, ToolScopes } from "../config/index.js";
import { AuthenticationError } from "../errors/index.js";
import { healthCheckOutputSchema } from "./schemas/index.js";
import { renderHealthCheck, requireClient } from "../utils/index.js";
import type { KomodoClient } from "../client.js";

const logger = baseLogger.child({ component: "config-tools" });

/** What is at work here: this MCP server, and the framework it runs on. */
const VERSIONS = { mcp_server_version: SERVER_VERSION, framework_version: FRAMEWORK_VERSION } as const;

// ============================================================================
// Health Check
// ============================================================================

export const healthCheckTool = defineTool({
  name: "komodo_health_check",
  description:
    "Check the Komodo connection status. Returns health, authentication status, the Komodo version, and the " +
    "versions of this MCP server and its framework. " +
    "Works without an active connection (reports unconfigured state).",
  input: z.object({}),
  output: healthCheckOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONFIG },
  requiredScopes: [ToolScopes.READ],
  handler: async () => {
    // Resolve the connection for the current context (per-user when authenticated, global
    // otherwise). A missing connection is reported as unconfigured rather than thrown.
    let client: KomodoClient | null;
    try {
      client = requireClient();
    } catch {
      client = null;
    }

    if (!client) {
      const payload = {
        configured: false,
        healthy: false,
        ...VERSIONS,
      };
      return structured(payload, { text: renderHealthCheck(payload) });
    }

    try {
      const health = await client.healthCheck();

      if (health.healthy) {
        const payload = {
          configured: true,
          healthy: true,
          server: client.url,
          ...(health.version ? { komodo_version: health.version } : {}),
          ...VERSIONS,
        };
        return structured(payload, { text: renderHealthCheck(payload) });
      }

      logger.warn("Health check failed for %s: %s", client.url, health.error);
      const payload = {
        configured: true,
        healthy: false,
        server: client.url,
        ...VERSIONS,
        ...(health.error ? { error: health.error } : {}),
      };
      return structured(payload, { text: renderHealthCheck(payload) });
    } catch (error) {
      // AuthenticationError (401/403) — propagate with clear message + recovery hint
      if (error instanceof AuthenticationError) throw error;

      logger.warn("Health check error for %s: %s", client.url, error instanceof Error ? error.message : String(error));
      const errMsg = error instanceof Error ? error.message : String(error);
      const payload = {
        configured: true,
        healthy: false,
        server: client.url,
        ...VERSIONS,
        error: errMsg,
      };
      return structured(payload, { text: renderHealthCheck(payload) });
    }
  },
});
