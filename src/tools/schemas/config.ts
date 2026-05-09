/**
 * Config / Health Schemas
 *
 * Zod schemas for the bootstrap (`komodo_configure`) and `komodo_health_check`
 * tool outputs.
 *
 * @module tools/schemas/config
 */

import { z } from "mcp-server-framework";

/**
 * Output of `komodo_health_check`.
 *
 * `configured = false` indicates that no Komodo connection has been
 * established yet (i.e. `komodo_configure` has not run successfully).
 */
export const healthCheckOutputSchema = z
  .object({
    configured: z.boolean().describe("Whether a Komodo client connection has been configured"),
    healthy: z.boolean().describe("Whether the Komodo server responded successfully to a health probe"),
    server: z.string().optional().describe("Komodo Core URL the client is bound to, when configured"),
    komodo_version: z.string().optional().describe("Komodo Core version reported by the health probe"),
    mcp_server_version: z.string().describe("Version of this MCP server"),
    error: z.string().optional().describe("Error message when the health probe failed"),
  })
  .describe("Connection and health status of the Komodo MCP server");
