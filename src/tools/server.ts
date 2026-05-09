/**
 * Server Tools
 *
 * Tools for listing, inspecting, creating, updating, and deleting Komodo servers,
 * plus host-level resource pruning (`komodo_server_prune`) which targets a
 * server resource (not a container).
 *
 * @module tools/server
 */

import { defineTool, structured, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS, ToolCategories, ToolScopes } from "../config/index.js";
import {
  serverConfigSchema,
  serverIdSchema,
  resourceNameSchema,
  pruneTargetSchema,
  serverListOutputSchema,
  serverInfoOutputSchema,
  serverStatsOutputSchema,
  actionResultSchema,
} from "./schemas/index.js";
import {
  formatActionResponse,
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  renderServerList,
  renderServerInfo,
  renderServerStats,
  renderActionResult,
} from "../utils/index.js";

type ServerListItem = Types.ServerListItem;

// ============================================================================
// List
// ============================================================================

export const listServersTool = defineTool({
  name: "komodo_server_list",
  description:
    "List all servers registered in Komodo. Shows server name, ID, status (healthy/unhealthy/disabled), Periphery version, and region.",
  input: z.object({}),
  output: serverListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.READ],
  handler: async (_args, { abortSignal }) => {
    const komodo = requireClient();
    const servers = await wrapApiCall("listServers", () => komodo.client.read("ListServers", {}), abortSignal);

    const items = servers.map((s: ServerListItem) => {
      const version = s.info.version && s.info.version.toLowerCase() !== "unknown" ? s.info.version : undefined;
      return {
        id: s.id,
        name: s.name,
        state: s.info.state,
        ...(version ? { version } : {}),
        ...(s.info.region ? { region: s.info.region } : {}),
      };
    });

    const payload = { items };
    return structured(payload, { text: renderServerList(payload) });
  },
});

// ============================================================================
// Stats
// ============================================================================

export const getServerStatsTool = defineTool({
  name: "komodo_server_stats",
  description:
    "Get server health status and state. Returns whether the Periphery agent is reachable and the server is healthy. For detailed system metrics, use komodo_server_info.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_STATS),
  }),
  output: serverStatsOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const stats = await wrapApiCall(
      `get stats for server '${args.server}'`,
      () => komodo.client.read("GetServerState", { server: args.server }),
      abortSignal,
    );
    const payload = { server: args.server, status: stats.status };
    return structured(payload, { text: renderServerStats(payload) });
  },
});

// ============================================================================
// Info / CRUD
// ============================================================================

export const getServerInfoTool = defineTool({
  name: "komodo_server_info",
  description: "Get detailed information about a specific server",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  output: serverInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getServerInfo",
      () => komodo.client.read("GetServer", { server: args.server }),
      abortSignal,
    );
    const payload = {
      summary: { id: args.server, name: args.server },
      info: result,
    };
    return structured(payload, { text: renderServerInfo(payload) });
  },
});

export const createServerTool = defineTool({
  name: "komodo_server_create",
  description:
    "Register a new server in Komodo. The server must have Periphery agent running. Provide the address for Core -> Periphery connections.",
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.ADMIN],
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
  name: "komodo_server_update",
  description:
    "Update an existing server configuration (PATCH-style: only provided fields are updated, others remain unchanged).",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    config: serverConfigSchema.partial().describe(CONFIG_DESCRIPTIONS.SERVER_CONFIG_PARTIAL),
  }),
  annotations: { idempotentHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.ADMIN],
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
  name: "komodo_server_delete",
  description: "Delete (unregister) a server",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.ADMIN],
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

// ============================================================================
// Prune (host-level resource cleanup)
// ============================================================================

/**
 * Maps prune target names to Komodo execute API action names.
 * The underlying Komodo APIs (PruneContainers/Images/Volumes/Networks/System)
 * target a server, so the tool lives in `tools/server.ts`.
 */
const PRUNE_ACTION_MAP: Record<string, string> = {
  containers: "PruneContainers",
  images: "PruneImages",
  volumes: "PruneVolumes",
  networks: "PruneNetworks",
  system: "PruneSystem",
};

export const serverPruneTool = defineTool({
  name: "komodo_server_prune",
  description:
    "Prune unused Docker resources on a server. This permanently removes stopped containers, unused images, volumes, or networks to free up resources.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    pruneTarget: pruneTargetSchema,
  }),
  output: actionResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();

    if (args.pruneTarget === "all") {
      const targets = ["containers", "images", "volumes", "networks"] as const;
      for (const target of targets) {
        await wrapExecuteAndPoll(
          `prune${target}`,
          () => komodo.client.execute(PRUNE_ACTION_MAP[target] as "PruneContainers", { server: args.server }),
          abortSignal,
          reportProgress,
        );
      }
      const payload = {
        success: true,
        status: "Complete",
        action: "prune",
        resource_type: "server" as const,
        resource_id: args.server,
        server: args.server,
      };
      return structured(payload, { text: renderActionResult(payload) });
    }

    const action = PRUNE_ACTION_MAP[args.pruneTarget];
    const update = await wrapExecuteAndPoll(
      "pruneResources",
      () => komodo.client.execute(action as "PruneContainers", { server: args.server }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, `prune-${args.pruneTarget}`, "server", args.server, args.server);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});
