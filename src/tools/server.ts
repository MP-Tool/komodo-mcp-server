/**
 * Server Tools
 *
 * Tools for listing, inspecting, applying (create-or-update), and deleting Komodo servers,
 * plus host-level operations (`komodo_server_action`) for batch container lifecycle,
 * Docker pruning, and resource deletion.
 *
 * @module tools/server
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  serverApplyInputSchema,
  serverIdSchema,
  serverActionInputSchema,
  serverActionOutputSchema,
  serverListOutputSchema,
  serverInfoOutputSchema,
  serverStatsOutputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";
import {
  requireClient,
  wrapApiCall,
  paginate,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  renderServerList,
  renderServerInfo,
  renderServerStats,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";

type ServerListItem = Types.ServerListItem;

// ============================================================================
// List
// ============================================================================

export const listServersTool = defineTool({
  name: "komodo_server_list",
  description:
    "List all servers registered in Komodo. Shows server name, ID, status (healthy/unhealthy/disabled), Periphery version, and region.",
  input: paginationInputSchema,
  output: serverListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const servers = await wrapApiCall("listServers", () => komodo.client.read("ListServers", {}), abortSignal);

    const allItems = servers.map((s: ServerListItem) => {
      const version = s.info.version && s.info.version.toLowerCase() !== "unknown" ? s.info.version : undefined;
      return {
        id: s.id,
        name: s.name,
        state: s.info.state,
        ...(version ? { version } : {}),
        ...(s.info.region ? { region: s.info.region } : {}),
      };
    });

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
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
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    })
    .merge(inlineFullInputSchema),
  output: serverInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getServerInfo",
      () => komodo.client.read("GetServer", { server: args.server }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${args.server} (server info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full server resource for ${args.server}`,
    });
    const summary = { id: args.server, name: args.server };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderServerInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

export const applyServerTool = defineTool({
  name: "komodo_server_apply",
  description: [
    "Create or update a Komodo Server (PATCH-style; safe to call repeatedly).",
    'action="create": new server. Required: name. Periphery agent must be reachable at config.address.',
    'action="update": existing server (`server` required). Only fields in `config` change.',
  ].join("\n"),
  input: serverApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const result = await wrapApiCall(
        "createServer",
        // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<ServerConfig>` (`T`).
        () =>
          komodo.client.write("CreateServer", {
            name,
            config: (args.config ?? {}) as Types._PartialServerConfig,
          }),
        abortSignal,
      );
      const built = buildApplyResult("create", "server", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.server) throw AppErrorFactory.validation.fieldRequired("server");
    const server = args.server;
    const result = await wrapApiCall(
      "updateServer",
      // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<ServerConfig>` (`T`).
      () =>
        komodo.client.write("UpdateServer", {
          id: server,
          config: args.config as Types._PartialServerConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "server", server, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteServerTool = defineTool({
  name: "komodo_server_delete",
  description: "Delete (unregister) a server",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  output: deleteResultSchema,
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
    const built = buildDeleteResult("server", args.server, result);
    return structured(built.payload, { text: built.text });
  },
});

// ============================================================================
// Prune (host-level resource cleanup)
// ============================================================================

/**
 * Maps the `komodo_server_action` discriminator to the Komodo execute API name.
 * All targeted endpoints are host-scoped (single `{ server }` param), the
 * `delete_*` variants additionally require a `{ name }` param (validated at runtime).
 */
const SERVER_ACTION_API_MAP = {
  start_all_containers: "StartAllContainers",
  restart_all_containers: "RestartAllContainers",
  pause_all_containers: "PauseAllContainers",
  unpause_all_containers: "UnpauseAllContainers",
  stop_all_containers: "StopAllContainers",
  prune_containers: "PruneContainers",
  prune_images: "PruneImages",
  prune_volumes: "PruneVolumes",
  prune_networks: "PruneNetworks",
  prune_system: "PruneSystem",
  prune_docker_builders: "PruneDockerBuilders",
  prune_buildx: "PruneBuildx",
  delete_network: "DeleteNetwork",
  delete_image: "DeleteImage",
  delete_volume: "DeleteVolume",
} as const;

export const serverActionTool = defineTool({
  name: "komodo_server_action",
  description:
    "Host-level operations on a Komodo server: batch container lifecycle (start/restart/pause/unpause/stop all), Docker resource pruning (containers, images, volumes, networks, system, builders, buildx), or deletion of named networks/images/volumes. Destructive — frees disk space or stops workloads.",
  input: serverActionInputSchema,
  output: serverActionOutputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true },
  _meta: { category: ToolCategories.SERVER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = SERVER_ACTION_API_MAP[args.action];

    let params: Record<string, unknown>;
    if (args.action === "delete_network" || args.action === "delete_image" || args.action === "delete_volume") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      params = { server: args.server, name: args.name };
    } else {
      params = { server: args.server };
    }

    const update = await wrapExecuteAndPoll(
      `${args.action} on server '${args.server}'`,
      // @sdk-constraint — SDK execute() type uses literal-keyed unions; runtime accepts mapped string
      () => komodo.client.execute(apiAction as "PruneContainers", params as unknown as Types.PruneContainers),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "server", args.server, args.server);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});
