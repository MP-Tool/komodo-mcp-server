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
 * Input of `komodo_configure`.
 *
 * Accepts one of three mutually-exclusive auth methods:
 * - `username` + `password` (local login)
 * - `apiKey` + `apiSecret`
 * - `jwtToken`
 *
 * Cross-field validation (exactly one method) is performed in the handler so
 * Zod-to-JSON-Schema emits a flat object that MCP Inspector can render.
 */
export const configureInputSchema = z
  .object({
    url: z.string().url().describe("Komodo Core server URL (e.g., http://host.docker.internal:9120)"),
    username: z.string().min(1).describe("Komodo username (for password auth)").optional(),
    password: z.string().min(1).describe("Komodo password (for password auth)").optional(),
    apiKey: z.string().min(1).describe("Komodo API key (for API-key auth)").optional(),
    apiSecret: z.string().min(1).describe("Komodo API secret (for API-key auth)").optional(),
    jwtToken: z.string().min(1).describe("Komodo JWT token (for JWT auth)").optional(),
  })
  .describe("Komodo connection options (provide exactly one auth method)");

/**
 * Output of `komodo_configure`.
 *
 * Returned on the success and partial-success branches. Validation failures
 * are signalled via `error(...)` and do not carry structured content.
 */
export const configureOutputSchema = z
  .object({
    configured: z.boolean().describe("Whether the client connection has been established"),
    healthy: z.boolean().describe("Whether the post-connect health probe succeeded"),
    server: z.string().describe("Komodo Core URL the client is bound to"),
    auth_method: z.string().describe("Resolved auth method (password, api-key, jwt)"),
    komodo_version: z.string().optional().describe("Komodo Core version, when reported by the health probe"),
    login_methods: z.string().optional().describe("Comma-separated login methods advertised by the server"),
    error: z.string().optional().describe("Error message when the health probe failed"),
  })
  .describe("Connection state established by komodo_configure");

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
