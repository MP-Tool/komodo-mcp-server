/**
 * Stack Tools
 *
 * Tools for listing, managing, and controlling Docker Compose stacks in Komodo.
 *
 * Tools (5):
 * - `komodo_stack_list`     — list stacks
 * - `komodo_stack_info`     — detailed stack information
 * - `komodo_stack_apply`    — create-or-update (discriminated by `action`)
 * - `komodo_stack_delete`   — remove stack from Komodo
 * - `komodo_stack_action`   — consolidated lifecycle (deploy/pull/start/restart/pause/unpause/stop/destroy)
 *
 * @module tools/stack
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  paginate,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  renderStackList,
  renderStackInfo,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  stackApplyInputSchema,
  stackActionInputSchema,
  stackIdSchema,
  stackListOutputSchema,
  stackInfoOutputSchema,
  actionResultSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type StackListItem = Types.StackListItem;

// ============================================================================
// List
// ============================================================================

export const listStacksTool = defineTool({
  name: "komodo_stack_list",
  description: "List all Komodo-managed Compose stacks. Shows stack name, ID, and current state.",
  input: paginationInputSchema,
  output: stackListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const stacks = await wrapApiCall("list stacks", () => komodo.client.read("ListStacks", {}), abortSignal);
    const allItems = stacks.map((s: StackListItem) => ({
      id: s.id,
      name: s.name,
      state: s.info.state,
      ...(s.info.server_id ? { server_id: s.info.server_id } : {}),
    }));
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderStackList(payload) });
  },
});

// ============================================================================
// Info / CRUD
// ============================================================================

export const getStackInfoTool = defineTool({
  name: "komodo_stack_info",
  description:
    "Get detailed information about a Compose stack including configuration, current state, compose file contents, services, and environment variables.",
  input: z
    .object({
      stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID_FOR_INFO),
    })
    .merge(inlineFullInputSchema),
  output: stackInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getStackInfo",
      () => komodo.client.read("GetStack", { stack: args.stack }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${args.stack} (stack info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full stack resource for ${args.stack}`,
    });
    const summary = { id: args.stack, name: args.stack };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderStackInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

export const applyStackTool = defineTool({
  name: "komodo_stack_apply",
  description: [
    "Create or update a Docker Compose stack in Komodo (PATCH-style).",
    'action="create": new stack. Required: name. Recommended: server_id (Compose) or swarm_id (Swarm).',
    'action="update": existing stack (`stack` required). Only fields in `config` change.',
    "File source on create: file_contents | repo+branch | files_on_host.",
  ].join("\n"),
  input: stackApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const stackConfig: Record<string, unknown> = { ...args.config };
      if (args.server_id) stackConfig.server_id = args.server_id;
      const result = await wrapApiCall(
        "createStack",
        () => komodo.client.write("CreateStack", { name, config: stackConfig }),
        abortSignal,
      );
      const built = buildApplyResult("create", "stack", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.stack) throw AppErrorFactory.validation.fieldRequired("stack");
    const stackId = args.stack;
    const result = await wrapApiCall(
      "updateStack",
      // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<StackConfig>` (`T`).
      () =>
        komodo.client.write("UpdateStack", {
          id: stackId,
          config: args.config as Types._PartialStackConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "stack", stackId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteStackTool = defineTool({
  name: "komodo_stack_delete",
  description:
    "Delete a Compose stack from Komodo. This removes the stack configuration but does not affect running containers.",
  input: z.object({
    stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteStack",
      () => komodo.client.write("DeleteStack", { id: args.stack }),
      abortSignal,
    );
    const built = buildDeleteResult("stack", args.stack, result);
    return structured(built.payload, { text: built.text });
  },
});

// ============================================================================
// Lifecycle
// ============================================================================

/** Maps the action enum to the corresponding Komodo execute API name. */
const STACK_ACTION_API_MAP = {
  deploy: "DeployStack",
  pull: "PullStack",
  start: "StartStack",
  restart: "RestartStack",
  pause: "PauseStack",
  unpause: "UnpauseStack",
  stop: "StopStack",
  destroy: "DestroyStack",
} as const satisfies Record<
  z.infer<typeof stackActionInputSchema>["action"],
  | "DeployStack"
  | "PullStack"
  | "StartStack"
  | "RestartStack"
  | "PauseStack"
  | "UnpauseStack"
  | "StopStack"
  | "DestroyStack"
>;

export const stackActionTool = defineTool({
  name: "komodo_stack_action",
  description:
    "Lifecycle action on a Compose stack: deploy (up), pull, start, restart, pause, unpause, stop, destroy (down — removes containers). destroy is destructive; config preserved.",
  input: stackActionInputSchema,
  output: actionResultSchema,
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = STACK_ACTION_API_MAP[args.action];
    const update = await wrapExecuteAndPoll(
      `${args.action} stack`,
      () => komodo.client.execute(apiAction, { stack: args.stack }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "stack", args.stack);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});
