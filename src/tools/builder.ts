/**
 * Builder Tools
 *
 * Manage Komodo Builder resources — the compute target Komodo uses to run a Docker
 * build (referenced by a Build's `builder_id`). Closes a real gap: `komodo_build_action(run)`
 * fails with "Must attach builder to RunBuild" when no Builder exists.
 *
 * Tools (6): list / info / apply (create-or-update) / copy / rename / delete.
 *
 * Writes enforce per-resource RBAC and require destructive confirmation on delete; the central
 * secret-scrub boundary covers output (builder AWS config can carry provider tokens).
 *
 * @module tools/builder
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  requireKomodoPermission,
  requireKomodoCreatePermission,
  requireDestructiveConfirmation,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  buildApplyResult,
  buildDeleteResult,
  paginate,
  tryRegisterResource,
  renderActionResult,
  renderBuilderList,
  renderBuilderInfo,
} from "../utils/index.js";
import {
  builderIdSchema,
  builderListOutputSchema,
  builderInfoOutputSchema,
  builderApplyInputSchema,
  toBuilderConfig,
  builderCopyInputSchema,
  builderRenameInputSchema,
  actionResultSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type BuilderListItem = Types.BuilderListItem;
const { Read, Write } = Types.PermissionLevel;

// ============================================================================
// List
// ============================================================================

export const listBuildersTool = defineTool({
  name: "komodo_builder_list",
  description:
    "List all builders registered in Komodo. Builders are compute targets Komodo uses to run Docker builds (Periphery address, a connected server, or an on-demand AWS EC2 instance).",
  input: paginationInputSchema,
  output: builderListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.BUILDER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const builders = await wrapApiCall("listBuilders", () => komodo.client.read("ListBuilders", {}), abortSignal);
    const allItems = builders.map((b: BuilderListItem) => ({
      id: b.id,
      name: b.name,
      builder_type: b.info.builder_type,
      ...(b.info.instance_type ? { instance_type: b.info.instance_type } : {}),
    }));
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderBuilderList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getBuilderInfoTool = defineTool({
  name: "komodo_builder_info",
  description:
    "Get the full Komodo Builder resource (type, connection/instance configuration). Offloaded via a session-scoped resource link unless `inline_full` is set.",
  input: z.object({ builder: builderIdSchema.describe("Builder id or name") }).merge(inlineFullInputSchema),
  output: builderInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.BUILDER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Builder", id: args.builder }, Read);
    const result = await wrapApiCall(
      "getBuilder",
      () => komodo.client.read("GetBuilder", { builder: args.builder }),
      abortSignal,
    );
    const summary = {
      id: result._id?.$oid ?? args.builder,
      name: result.name,
      ...(result.config?.type ? { builder_type: result.config.type } : {}),
    };
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (builder info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full builder resource for ${result.name}`,
    });
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, { text: renderBuilderInfo(payload), ...(link ? { links: [link] } : {}) });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyBuilderTool = defineTool({
  name: "komodo_builder_apply",
  description: [
    "Create or update a Komodo Builder (PATCH-style). Attach a builder to a Build's `builder_id` before running it.",
    'action="create": new builder. Required: name. In `config` set `builder_type` ("Url", "Server", or "Aws") and the fields for that backend (e.g. Server → server_id; Url → address; Aws → region, instance_type).',
    'action="update": existing builder (`builder` required). Only the `config` fields you set change.',
  ].join("\n"),
  input: builderApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.BUILDER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      requireKomodoCreatePermission("Builder");
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const config = toBuilderConfig(args.config);
      const result = await wrapApiCall(
        "createBuilder",
        () => komodo.client.write("CreateBuilder", { name, ...(config && { config }) }),
        abortSignal,
      );
      const built = buildApplyResult("create", "builder", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.builder) throw AppErrorFactory.validation.fieldRequired("builder");
    const config = toBuilderConfig(args.config);
    if (!config) throw AppErrorFactory.validation.fieldRequired("config");
    await requireKomodoPermission({ type: "Builder", id: args.builder }, Write);
    const builderId = args.builder;
    const result = await wrapApiCall(
      "updateBuilder",
      () => komodo.client.write("UpdateBuilder", { id: builderId, config }),
      abortSignal,
    );
    const built = buildApplyResult("update", "builder", builderId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const copyBuilderTool = defineTool({
  name: "komodo_builder_copy",
  description: "Create a new Komodo Builder named `name`, copying the configuration of the builder at `id`.",
  input: builderCopyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.BUILDER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Builder", id: args.id }, Read);
    const result = await wrapApiCall(
      "copyBuilder",
      () => komodo.client.write("CopyBuilder", { name: args.name, id: args.id }),
      abortSignal,
    );
    const built = buildApplyResult("create", "builder", args.name, result);
    return structured(built.payload, { text: built.text });
  },
});

export const renameBuilderTool = defineTool({
  name: "komodo_builder_rename",
  description: "Rename a Komodo Builder.",
  input: builderRenameInputSchema,
  output: actionResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.BUILDER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal, reportProgress }) => {
    await requireKomodoPermission({ type: "Builder", id: args.builder }, Write);
    // RenameBuilder is dispatched via .write() (it's in the SDK's WriteRequest union) but its
    // response is Types.Update — an async operation, so poll it like a lifecycle action.
    const update = await wrapExecuteAndPoll(
      "renameBuilder",
      () => requireClient().client.write("RenameBuilder", { id: args.builder, name: args.name }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, "rename", "builder", args.builder);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});

export const deleteBuilderTool = defineTool({
  name: "komodo_builder_delete",
  description: "Unregister a Builder from Komodo. Builds that reference this builder's id will fail until re-attached.",
  input: z.object({ builder: builderIdSchema.describe("Builder id or name to delete") }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.BUILDER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Builder", id: args.builder }, Write);
    await requireDestructiveConfirmation({ action: "delete", resourceType: "builder", resourceId: args.builder });
    const result = await wrapApiCall(
      "deleteBuilder",
      () => komodo.client.write("DeleteBuilder", { id: args.builder }),
      abortSignal,
    );
    const built = buildDeleteResult("builder", args.builder, result);
    return structured(built.payload, { text: built.text });
  },
});
