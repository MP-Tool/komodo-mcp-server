/**
 * ResourceSync Tools
 *
 * Tools for managing Komodo ResourceSync (GitOps reconciliation of TOML resource files).
 *
 * Tools (5):
 * - `komodo_resource_sync_list`   — list registered resource syncs
 * - `komodo_resource_sync_info`   — full resource sync resource
 * - `komodo_resource_sync_action` — lifecycle: run | refresh
 * - `komodo_resource_sync_apply`  — create-or-update (discriminated by `action`)
 * - `komodo_resource_sync_delete` — unregister a resource sync
 *
 * @module tools/resource-sync
 */

import { defineTool, structured, text, z } from "mcp-server-framework";
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
  renderResourceSyncList,
  renderResourceSyncInfo,
  renderActionResult,
  tryRegisterResource,
  formatActionResponse,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  resourceSyncIdSchema,
  resourceSyncListOutputSchema,
  resourceSyncInfoOutputSchema,
  resourceSyncActionOutputSchema,
  resourceSyncActionInputSchema,
  resourceSyncApplyInputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type ResourceSyncListItem = Types.ResourceSyncListItem;

// ============================================================================
// List
// ============================================================================

export const listResourceSyncsTool = defineTool({
  name: "komodo_resource_sync_list",
  description:
    "List all resource syncs registered in Komodo. Shows configured repo+branch, managed mode, and last successful sync timestamp/hash.",
  input: paginationInputSchema,
  output: resourceSyncListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.RESOURCE_SYNC },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const syncs = await wrapApiCall(
      "listResourceSyncs",
      () => komodo.client.read("ListResourceSyncs", {}),
      abortSignal,
    );

    const allItems = syncs.map((s: ResourceSyncListItem) => ({
      id: s.id,
      name: s.name,
      state: s.info.state,
      managed: s.info.managed,
      ...(s.info.repo ? { repo: s.info.repo } : {}),
      ...(s.info.branch ? { branch: s.info.branch } : {}),
      ...(Array.isArray(s.info.resource_path) && s.info.resource_path.length > 0
        ? { resource_path: s.info.resource_path }
        : {}),
      ...(s.info.last_sync_ts ? { last_sync_ts: s.info.last_sync_ts } : {}),
      ...(s.info.last_sync_hash ? { last_sync_hash: s.info.last_sync_hash } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderResourceSyncList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getResourceSyncInfoTool = defineTool({
  name: "komodo_resource_sync_info",
  description: "Get the full Komodo ResourceSync resource including pending diffs.",
  input: z
    .object({
      resource_sync: resourceSyncIdSchema.describe("ResourceSync id or name"),
    })
    .merge(inlineFullInputSchema),
  output: resourceSyncInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.RESOURCE_SYNC },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getResourceSync",
      () => komodo.client.read("GetResourceSync", { sync: args.resource_sync }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (resource sync info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full resource sync payload for ${result.name}`,
    });
    const summary = {
      id: result._id?.$oid ?? args.resource_sync,
      name: result.name,
    };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderResourceSyncInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Lifecycle (consolidated action)
// ============================================================================

export const resourceSyncActionTool = defineTool({
  name: "komodo_resource_sync_action",
  description:
    "Lifecycle action on a Komodo ResourceSync. 'run' executes the sync (applies pending changes — long-running, polled). 'refresh' updates the pending-changes preview without applying anything.",
  input: resourceSyncActionInputSchema,
  output: resourceSyncActionOutputSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.RESOURCE_SYNC },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    if (args.action === "run") {
      const update = await wrapExecuteAndPoll(
        `run resource sync '${args.resource_sync}'`,
        () => komodo.client.execute("RunSync", { sync: args.resource_sync }),
        abortSignal,
        reportProgress,
      );
      const payload = buildActionResult(update, "deploy", "resource_sync", args.resource_sync);
      return structured(payload, {
        text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
      });
    }
    // refresh — fire-and-forget; returns the updated ResourceSync resource
    const result = await wrapApiCall(
      "refreshResourceSyncPending",
      () => komodo.client.write("RefreshResourceSyncPending", { sync: args.resource_sync }),
      abortSignal,
    );
    const header = formatActionResponse({
      action: "update",
      resourceType: "resource_sync",
      resourceId: args.resource_sync,
    });
    return text(`${header} (pending preview refreshed)\n\n${JSON.stringify(result, null, 2)}`);
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyResourceSyncTool = defineTool({
  name: "komodo_resource_sync_apply",
  description: [
    "Create or update a Komodo ResourceSync (PATCH-style on update). Not executed automatically — call `komodo_resource_sync_action` with action='run' afterwards.",
    'action="create": new sync. Required: name. Provide `config` with repo+branch+resource_path or inline file_contents.',
    'action="update": existing sync (`resource_sync` required). Only fields in `config` change.',
  ].join("\n"),
  input: resourceSyncApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.RESOURCE_SYNC },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const result = await wrapApiCall(
        "createResourceSync",
        // @type-variance — open record → SDK _PartialResourceSyncConfig
        () =>
          komodo.client.write("CreateResourceSync", { name, config: args.config as Types._PartialResourceSyncConfig }),
        abortSignal,
      );
      const built = buildApplyResult("create", "resource_sync", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.resource_sync) throw AppErrorFactory.validation.fieldRequired("resource_sync");
    const syncId = args.resource_sync;
    const result = await wrapApiCall(
      "updateResourceSync",
      // @type-variance — open record → SDK _PartialResourceSyncConfig
      () =>
        komodo.client.write("UpdateResourceSync", {
          id: syncId,
          config: args.config as Types._PartialResourceSyncConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "resource_sync", syncId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteResourceSyncTool = defineTool({
  name: "komodo_resource_sync_delete",
  description: "Unregister a ResourceSync from Komodo. Resources created via previous syncs are not removed.",
  input: z.object({
    resource_sync: resourceSyncIdSchema.describe("ResourceSync id or name to delete"),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.RESOURCE_SYNC },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteResourceSync",
      () => komodo.client.write("DeleteResourceSync", { id: args.resource_sync }),
      abortSignal,
    );
    const built = buildDeleteResult("resource_sync", args.resource_sync, result);
    return structured(built.payload, { text: built.text });
  },
});
