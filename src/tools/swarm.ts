/**
 * Swarm Tools
 *
 * Tools for managing Komodo Swarm resources (Komodo v2).
 *
 * A Swarm groups Docker Swarm manager Servers and exposes per-node /
 * per-service / per-stack operations on top of the underlying cluster.
 *
 * Tools (7):
 * - `komodo_swarm_list`           — list registered swarms
 * - `komodo_swarm_info`           — full swarm resource
 * - `komodo_swarm_apply`          — create-or-update (discriminated by `action`)
 * - `komodo_swarm_delete`         — unregister a swarm
 * - `komodo_swarm_nodes_list`     — list nodes participating in a swarm
 * - `komodo_swarm_services_list`  — list services running on a swarm
 * - `komodo_swarm_action`         — node/service/stack management
 *
 * @module tools/swarm
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  paginate,
  renderSwarmList,
  renderSwarmInfo,
  renderSwarmNodesList,
  renderSwarmServicesList,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  swarmIdSchema,
  swarmListOutputSchema,
  swarmInfoOutputSchema,
  swarmActionOutputSchema,
  swarmActionInputSchema,
  swarmApplyInputSchema,
  swarmNodesListOutputSchema,
  swarmServicesListOutputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type SwarmListItem = Types.SwarmListItem;
type SwarmNodeListItem = Types.SwarmNodeListItem;
type SwarmServiceListItem = Types.SwarmServiceListItem;

// ============================================================================
// List
// ============================================================================

export const listSwarmsTool = defineTool({
  name: "komodo_swarm_list",
  description:
    "List all swarms registered in Komodo. Each swarm groups one or more Server resources that act as Docker Swarm managers.",
  input: paginationInputSchema,
  output: swarmListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const swarms = await wrapApiCall("listSwarms", () => komodo.client.read("ListSwarms", {}), abortSignal);

    const allItems = swarms.map((s: SwarmListItem) => ({
      id: s.id,
      name: s.name,
      state: s.info.state,
      server_ids: s.info.server_ids,
      ...(s.info.err ? { err: typeof s.info.err === "string" ? s.info.err : JSON.stringify(s.info.err) } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderSwarmList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getSwarmInfoTool = defineTool({
  name: "komodo_swarm_info",
  description:
    "Get the full Komodo Swarm resource (manager server ids, links, alert/maintenance configuration). Large payloads are offloaded via a session-scoped resource link when available.",
  input: z
    .object({
      swarm: swarmIdSchema.describe("Swarm id or name"),
    })
    .merge(inlineFullInputSchema),
  output: swarmInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getSwarm",
      () => komodo.client.read("GetSwarm", { swarm: args.swarm }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (swarm info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full swarm resource for ${result.name}`,
    });
    const summary = {
      id: result._id?.$oid ?? args.swarm,
      name: result.name,
      ...(result.config?.server_ids ? { server_ids: result.config.server_ids } : {}),
    };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderSwarmInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Nodes / Services list
// ============================================================================

export const listSwarmNodesTool = defineTool({
  name: "komodo_swarm_nodes_list",
  description: "List the Docker nodes participating in a Komodo Swarm.",
  input: z
    .object({
      swarm: swarmIdSchema.describe("Swarm id or name"),
    })
    .merge(paginationInputSchema),
  output: swarmNodesListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const nodes = await wrapApiCall(
      "listSwarmNodes",
      () => komodo.client.read("ListSwarmNodes", { swarm: args.swarm }),
      abortSignal,
    );

    const allItems = nodes.map((n: SwarmNodeListItem) => ({
      ...(n.ID ? { id: n.ID } : {}),
      ...(n.Name ? { name: n.Name } : {}),
      ...(n.Hostname ? { hostname: n.Hostname } : {}),
      ...(n.Role ? { role: n.Role } : {}),
      ...(n.Availability ? { availability: n.Availability } : {}),
      ...(n.State ? { state: n.State } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { swarm: args.swarm, items: [...items], page };
    return structured(payload, { text: renderSwarmNodesList(payload) });
  },
});

export const listSwarmServicesTool = defineTool({
  name: "komodo_swarm_services_list",
  description: "List Docker services running on a Komodo Swarm.",
  input: z
    .object({
      swarm: swarmIdSchema.describe("Swarm id or name"),
    })
    .merge(paginationInputSchema),
  output: swarmServicesListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const services = await wrapApiCall(
      "listSwarmServices",
      () => komodo.client.read("ListSwarmServices", { swarm: args.swarm }),
      abortSignal,
    );

    const allItems = services.map((s: SwarmServiceListItem) => ({
      ...(s.ID ? { id: s.ID } : {}),
      ...(s.Name ? { name: s.Name } : {}),
      ...(s.Image ? { image: s.Image } : {}),
      ...(s.Mode ? { mode: typeof s.Mode === "string" ? s.Mode : JSON.stringify(s.Mode) } : {}),
      ...(s.Replicas !== undefined ? { replicas: s.Replicas } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { swarm: args.swarm, items: [...items], page };
    return structured(payload, { text: renderSwarmServicesList(payload) });
  },
});

// ============================================================================
// Action (node/service/stack management)
// ============================================================================

/** Maps the action enum to the corresponding Komodo execute API name. */
const SWARM_ACTION_API_MAP = {
  update_node: "UpdateSwarmNode",
  remove_nodes: "RemoveSwarmNodes",
  remove_services: "RemoveSwarmServices",
  remove_stacks: "RemoveSwarmStacks",
} as const satisfies Record<"update_node" | "remove_nodes" | "remove_services" | "remove_stacks", string>;

export const swarmActionTool = defineTool({
  name: "komodo_swarm_action",
  description:
    "Swarm management. update_node: change availability/labels/role. remove_nodes: force-remove. remove_services / remove_stacks: equivalents of docker service rm / docker stack rm.",
  input: swarmActionInputSchema,
  output: swarmActionOutputSchema,
  annotations: { idempotentHint: false, destructiveHint: true },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = SWARM_ACTION_API_MAP[args.action];

    let params: Record<string, unknown>;
    switch (args.action) {
      case "update_node":
        if (!args.node) throw AppErrorFactory.validation.fieldRequired("node");
        params = {
          swarm: args.swarm,
          node: args.node,
          ...(args.availability ? { availability: args.availability } : {}),
          ...(args.label_add ? { label_add: args.label_add } : {}),
          ...(args.label_rm ? { label_rm: args.label_rm } : {}),
          ...(args.role ? { role: args.role } : {}),
        };
        break;
      case "remove_nodes":
        if (!args.nodes || args.nodes.length === 0) throw AppErrorFactory.validation.fieldRequired("nodes");
        params = { swarm: args.swarm, nodes: args.nodes, ...(args.force !== undefined ? { force: args.force } : {}) };
        break;
      case "remove_services":
        if (!args.services || args.services.length === 0) throw AppErrorFactory.validation.fieldRequired("services");
        params = { swarm: args.swarm, services: args.services };
        break;
      case "remove_stacks":
        if (!args.stacks || args.stacks.length === 0) throw AppErrorFactory.validation.fieldRequired("stacks");
        params = { swarm: args.swarm, stacks: args.stacks, detach: args.detach ?? false };
        break;
    }

    const update = await wrapExecuteAndPoll(
      `${args.action} on swarm '${args.swarm}'`,
      // @sdk-constraint — SDK execute() type uses literal-keyed unions; runtime accepts mapped string
      () => komodo.client.execute(apiAction as "UpdateSwarmNode", params as unknown as Types.UpdateSwarmNode),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "swarm", args.swarm);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applySwarmTool = defineTool({
  name: "komodo_swarm_apply",
  description: [
    "Create or update a Komodo Swarm (PATCH-style). Servers in config.server_ids form one Docker Swarm cluster.",
    'action="create": new swarm. Required: name. Recommended: config.server_ids.',
    'action="update": existing swarm (`swarm` required). Only fields in `config` change.',
  ].join("\n"),
  input: swarmApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const result = await wrapApiCall(
        "createSwarm",
        () =>
          komodo.client.write("CreateSwarm", {
            name,
            // @type-variance — permissive record cast to partial config; Komodo API validates fields server-side
            config: (args.config ?? {}) as Types._PartialSwarmConfig,
          }),
        abortSignal,
      );
      const built = buildApplyResult("create", "swarm", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.swarm) throw AppErrorFactory.validation.fieldRequired("swarm");
    const swarmId = args.swarm;
    const result = await wrapApiCall(
      "updateSwarm",
      () =>
        komodo.client.write("UpdateSwarm", {
          id: swarmId,
          // @type-variance — permissive record cast to partial config; Komodo API validates fields server-side
          config: args.config as Types._PartialSwarmConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "swarm", swarmId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteSwarmTool = defineTool({
  name: "komodo_swarm_delete",
  description:
    "Unregister a Swarm from Komodo. Does NOT teardown the underlying Docker Swarm — it only removes the Komodo resource entry.",
  input: z.object({
    swarm: swarmIdSchema.describe("Swarm id or name to delete"),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.SWARM },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteSwarm",
      () => komodo.client.write("DeleteSwarm", { id: args.swarm }),
      abortSignal,
    );
    const built = buildDeleteResult("swarm", args.swarm, result);
    return structured(built.payload, { text: built.text });
  },
});
