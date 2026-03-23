/**
 * Stack Tools
 *
 * Tools for listing, managing, and controlling Docker Compose stacks in Komodo.
 *
 * @module tools/stack
 */

import { defineTool, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from "../config/index.js";
import { formatActionResponse, formatInfoResponse } from "../utils/index.js";
import {
  stackConfigSchema,
  createStackConfigSchema,
  stackIdSchema,
  resourceNameSchema,
  serverIdSchema,
} from "./schemas/index.js";
import { requireClient, wrapApiCall, extractUpdateId } from "./utils.js";

type StackListItem = Types.StackListItem;

// ============================================================================
// List
// ============================================================================

export const listStacksTool = defineTool({
  name: "komodo_list_stacks",
  description: "List all Komodo-managed Compose stacks. Shows stack name, ID, and current state.",
  input: z.object({}),
  annotations: { readOnlyHint: true },
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
  name: "komodo_get_stack_info",
  description:
    "Get detailed information about a Compose stack including configuration, current state, compose file contents, services, and environment variables.",
  input: z.object({
    stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID_FOR_INFO),
  }),
  annotations: { readOnlyHint: true },
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
  name: "komodo_create_stack",
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
  name: "komodo_update_stack",
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
  name: "komodo_delete_stack",
  description:
    "Delete a Compose stack from Komodo. This removes the stack configuration but does not affect running containers.",
  input: z.object({
    stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  annotations: { destructiveHint: true },
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
// Actions (deploy, pull, start, restart, pause, unpause, stop, destroy)
// ============================================================================

export const deployStackTool = defineTool({
  name: "komodo_deploy_stack",
  description: "Deploy a Komodo-managed Compose stack. Runs `docker compose up -d`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deploy stack",
      () => komodo.client.execute("DeployStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "deploy",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const pullStackTool = defineTool({
  name: "komodo_pull_stack",
  description: "Pull the latest images for a Compose stack without redeploying. Runs `docker compose pull`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "pull stack",
      () => komodo.client.execute("PullStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "pull",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const startStackTool = defineTool({
  name: "komodo_start_stack",
  description: "Start a stopped Compose stack. Runs `docker compose start`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "start stack",
      () => komodo.client.execute("StartStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "start",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const restartStackTool = defineTool({
  name: "komodo_restart_stack",
  description: "Restart a Compose stack. Runs `docker compose restart`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "restart stack",
      () => komodo.client.execute("RestartStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "restart",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const pauseStackTool = defineTool({
  name: "komodo_pause_stack",
  description: "Pause a running Compose stack. Runs `docker compose pause`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "pause stack",
      () => komodo.client.execute("PauseStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "pause",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const unpauseStackTool = defineTool({
  name: "komodo_unpause_stack",
  description: "Unpause a paused Compose stack. Runs `docker compose unpause`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "unpause stack",
      () => komodo.client.execute("UnpauseStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "unpause",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const stopStackTool = defineTool({
  name: "komodo_stop_stack",
  description: "Stop a running Compose stack. Runs `docker compose stop`.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "stop stack",
      () => komodo.client.execute("StopStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "stop",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});

export const destroyStackTool = defineTool({
  name: "komodo_destroy_stack",
  description: "Destroy a Compose stack. Runs `docker compose down` to stop and remove containers.",
  input: z.object({ stack: stackIdSchema.describe(PARAM_DESCRIPTIONS.STACK_ID) }),
  annotations: { destructiveHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "destroy stack",
      () => komodo.client.execute("DestroyStack", { stack: args.stack }),
      abortSignal,
    );
    return text(
      formatActionResponse({
        action: "destroy",
        resourceType: "stack",
        resourceId: args.stack,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
});
