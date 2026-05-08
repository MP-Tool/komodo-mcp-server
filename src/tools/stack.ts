/**
 * Stack Tools
 *
 * Tools for listing, managing, and controlling Docker Compose stacks in Komodo.
 *
 * Tools (6):
 * - `komodo_stack_list`     — list stacks
 * - `komodo_stack_info`     — detailed stack information
 * - `komodo_stack_create`   — create a new stack
 * - `komodo_stack_update`   — patch stack configuration
 * - `komodo_stack_delete`   — remove stack from Komodo
 * - `komodo_stack_action`   — consolidated lifecycle (deploy/pull/start/restart/pause/unpause/stop/destroy)
 *
 * @module tools/stack
 */

import { defineTool, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS, ToolCategories, ToolScopes } from "../config/index.js";
import {
  formatActionResponse,
  formatInfoResponse,
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  formatUpdateResult,
} from "../utils/index.js";
import {
  stackConfigSchema,
  createStackConfigSchema,
  stackActionInputSchema,
  stackIdSchema,
  resourceNameSchema,
  serverIdSchema,
} from "./schemas/index.js";

type StackListItem = Types.StackListItem;

// ============================================================================
// List
// ============================================================================

export const listStacksTool = defineTool({
  name: "komodo_stack_list",
  description: "List all Komodo-managed Compose stacks. Shows stack name, ID, and current state.",
  input: z.object({}),
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.READ],
  handler: async (_args, { abortSignal }) => {
    const komodo = requireClient();
    const stacks = await wrapApiCall("list stacks", () => komodo.client.read("ListStacks", {}), abortSignal);
    return text(
      `📚 Docker Compose stacks:\n\n${
        stacks.map((s: StackListItem) => `• ${s.name} (${s.id}) - State: ${s.info.state}`).join("\n") ||
        "No stacks found."
      }`,
    );
  },
});

// ============================================================================
// Info / CRUD
// ============================================================================

export const getStackInfoTool = defineTool({
  name: "komodo_stack_info",
  description:
    "Get detailed information about a Compose stack including configuration, current state, compose file contents, services, and environment variables.",
  input: z.object({
    stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID_FOR_INFO),
  }),
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getStackInfo",
      () => komodo.client.read("GetStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatInfoResponse({ resourceType: "stack", resourceId: args.stack, content: JSON.stringify(result, null, 2) }),
    );
  },
});

export const createStackTool = defineTool({
  name: "komodo_stack_create",
  description: `Create a new Docker Compose stack in Komodo.

REQUIRED: name
RECOMMENDED: server_id (target server)

STACK MODES:
- Compose Mode: Set server_id for single-server docker compose
- Swarm Mode: Set swarm_id to deploy as Docker Swarm stack

FILE SOURCES (choose one):
1. file_contents: Define compose YAML directly in the config
2. repo + branch: Clone from git repository
3. files_on_host: Use existing files on the server`,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.ADMIN],
  input: z.object({
    name: resourceNameSchema.describe(PARAM_DESCRIPTIONS.STACK_NAME),
    server_id: serverIdSchema.optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_COMPOSE),
    config: createStackConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.STACK_CONFIG_CREATE),
  }),
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const stackConfig: Record<string, unknown> = { ...args.config };
    if (args.server_id) stackConfig.server_id = args.server_id;

    const result = await wrapApiCall(
      "createStack",
      () => komodo.client.write("CreateStack", { name: args.name, config: stackConfig }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "create", resourceType: "stack", resourceId: args.name });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const updateStackTool = defineTool({
  name: "komodo_stack_update",
  description: `Update an existing Docker Compose stack configuration.

PATCH-STYLE UPDATE: Only specify fields you want to change.

COMMON UPDATE SCENARIOS:
- Update compose file: { file_contents: "version: '3'\\nservices:..." }
- Change env vars: { environment: "DB_HOST=localhost\\nDB_PORT=5432" }
- Enable auto-pull: { auto_pull: true }
- Switch git branch: { branch: "develop" }`,
  input: z.object({
    stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID_FOR_UPDATE),
    config: stackConfigSchema.describe(CONFIG_DESCRIPTIONS.STACK_CONFIG_PARTIAL),
  }),
  annotations: { idempotentHint: true },
  _meta: { category: ToolCategories.STACK },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "updateStack",
      // @type-variance — Zod .partial() output includes `| undefined` per field, komodo_client Partial<> does not
      () => komodo.client.write("UpdateStack", { id: args.stack, config: args.config as Types.StackConfig }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "update", resourceType: "stack", resourceId: args.stack });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const deleteStackTool = defineTool({
  name: "komodo_stack_delete",
  description:
    "Delete a Compose stack from Komodo. This removes the stack configuration but does not affect running containers.",
  input: z.object({
    stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
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
    const header = formatActionResponse({ action: "remove", resourceType: "stack", resourceId: args.stack });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
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
    "Run a lifecycle action on a Docker Compose stack: deploy (compose up), pull (latest images), " +
    "start, restart, pause, unpause, stop, or destroy (compose down — removes containers). " +
    "The `destroy` action is destructive (containers are removed); the stack configuration is preserved.",
  input: stackActionInputSchema,
  annotations: { idempotentHint: true, destructiveHint: true },
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
    return text(formatUpdateResult(update, args.action, "stack", args.stack));
  },
});
