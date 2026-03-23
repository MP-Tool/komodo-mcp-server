/**
 * Server Tools
 *
 * Tools for listing, inspecting, creating, updating, and deleting Komodo servers.
 *
 * @module tools/server
 */

import { defineTool, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from "../config/index.js";
import { serverConfigSchema, serverIdSchema, resourceNameSchema } from "./schemas/index.js";
import { formatActionResponse, formatInfoResponse } from "../utils/index.js";
import { requireClient, wrapApiCall } from "./utils.js";

type ServerListItem = Types.ServerListItem;

// ============================================================================
// List
// ============================================================================

export const listServersTool = defineTool({
  name: "komodo_list_servers",
  description:
    "List all servers registered in Komodo. Shows server name, ID, status (healthy/unhealthy/disabled), Periphery version, and region.",
  input: z.object({}),
  annotations: { readOnlyHint: true },
  handler: async (_args, { abortSignal }) => {
    const komodo = requireClient();
    const servers = await wrapApiCall("listServers", () => komodo.client.read("ListServers", {}), abortSignal);

    const serverList =
      servers
        .map((s: ServerListItem) => {
          const version = s.info.version && s.info.version.toLowerCase() !== "unknown" ? s.info.version : "N/A";
          const region = s.info.region || "";
          const regionStr = region ? ` | Region: ${region}` : "";
          return `• ${s.name} (${s.id}) - Status: ${s.info.state} | Version: ${version}${regionStr}`;
        })
        .join("\n") || "No servers found.";

    return text(`🖥️ Available servers:\n\n${serverList}`);
  },
});

// ============================================================================
// Stats
// ============================================================================

export const getServerStatsTool = defineTool({
  name: "komodo_get_server_stats",
  description:
    "Get server health status and state. Returns whether the Periphery agent is reachable and the server is healthy. For detailed system metrics, use komodo_get_server_info.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_STATS),
  }),
  annotations: { readOnlyHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const stats = await wrapApiCall(
      `get stats for server '${args.server}'`,
      () => komodo.client.read("GetServerState", { server: args.server }),
      abortSignal,
    );
    return text(`📊 Server "${args.server}" status:\n\n• Status: ${stats.status}`);
  },
});

// ============================================================================
// Info / CRUD
// ============================================================================

export const getServerInfoTool = defineTool({
  name: "komodo_get_server_info",
  description: "Get detailed information about a specific server",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  annotations: { readOnlyHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getServerInfo",
      () => komodo.client.read("GetServer", { server: args.server }),
      abortSignal,
    );
    return text(
      formatInfoResponse({ resourceType: "server", resourceId: args.server, content: JSON.stringify(result, null, 2) }),
    );
  },
});

export const createServerTool = defineTool({
  name: "komodo_create_server",
  description:
    "Register a new server in Komodo. The server must have Periphery agent running. Provide the address for Core -> Periphery connections.",
  input: z.object({
    name: resourceNameSchema.describe(PARAM_DESCRIPTIONS.SERVER_NAME),
    config: serverConfigSchema.partial().optional().describe(CONFIG_DESCRIPTIONS.SERVER_CONFIG_CREATE),
  }),
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "createServer",
      // @type-variance — Zod .partial() output includes `| undefined` per field, komodo_client Partial<> does not
      () => komodo.client.write("CreateServer", { name: args.name, config: (args.config || {}) as Types.ServerConfig }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "create", resourceType: "server", resourceId: args.name });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const updateServerTool = defineTool({
  name: "komodo_update_server",
  description:
    "Update an existing server configuration (PATCH-style: only provided fields are updated, others remain unchanged).",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    config: serverConfigSchema.partial().describe(CONFIG_DESCRIPTIONS.SERVER_CONFIG_PARTIAL),
  }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "updateServer",
      // @type-variance — Zod .partial() output includes `| undefined` per field, komodo_client Partial<> does not
      () => komodo.client.write("UpdateServer", { id: args.server, config: args.config as Types.ServerConfig }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "update", resourceType: "server", resourceId: args.server });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const deleteServerTool = defineTool({
  name: "komodo_delete_server",
  description: "Delete (unregister) a server",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  annotations: { destructiveHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteServer",
      () => komodo.client.write("DeleteServer", { id: args.server }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "remove", resourceType: "server", resourceId: args.server });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});
