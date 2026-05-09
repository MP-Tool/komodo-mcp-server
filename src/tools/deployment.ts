/**
 * Deployment Tools
 *
 * Tools for managing single-container Komodo deployments.
 *
 * Tools (6):
 * - `komodo_deployment_list`     — list deployments
 * - `komodo_deployment_info`     — detailed deployment information
 * - `komodo_deployment_create`   — create a deployment
 * - `komodo_deployment_update`   — patch deployment configuration
 * - `komodo_deployment_delete`   — remove deployment from Komodo
 * - `komodo_deployment_action`   — consolidated lifecycle (deploy/pull/start/restart/pause/unpause/stop/destroy)
 *
 * @module tools/deployment
 */

import { defineTool, structured, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS, ToolCategories, ToolScopes } from "../config/index.js";
import {
  formatActionResponse,
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  renderDeploymentList,
  renderDeploymentInfo,
  renderActionResult,
} from "../utils/index.js";
import {
  deploymentConfigSchema,
  createDeploymentConfigSchema,
  DeploymentImageSchema,
  deploymentActionInputSchema,
  deploymentIdSchema,
  resourceNameSchema,
  serverIdSchema,
  deploymentListOutputSchema,
  deploymentInfoOutputSchema,
  actionResultSchema,
} from "./schemas/index.js";

type DeploymentListItem = Types.DeploymentListItem;

// ============================================================================
// List
// ============================================================================

export const listDeploymentsTool = defineTool({
  name: "komodo_deployment_list",
  description:
    "List all Komodo-managed deployments. Deployments are single-container applications managed by Komodo. " +
    "Shows deployment name, ID, and current state.",
  input: z.object({}),
  output: deploymentListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.READ],
  handler: async (_args, { abortSignal }) => {
    const komodo = requireClient();
    const deployments = await wrapApiCall(
      "list deployments",
      () => komodo.client.read("ListDeployments", {}),
      abortSignal,
    );
    const items = deployments.map((d: DeploymentListItem) => ({
      id: d.id,
      name: d.name,
      state: d.info.state,
      ...(d.info.server_id ? { server_id: d.info.server_id } : {}),
    }));
    const payload = { items };
    return structured(payload, { text: renderDeploymentList(payload) });
  },
});

// ============================================================================
// Info / CRUD
// ============================================================================

export const getDeploymentInfoTool = defineTool({
  name: "komodo_deployment_info",
  description:
    "Get detailed information about a Komodo-managed deployment, including its configuration, current state, and assigned server.",
  input: z.object({
    deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID_FOR_INFO),
  }),
  output: deploymentInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getDeployment",
      () => komodo.client.read("GetDeployment", { deployment: args.deployment }),
      abortSignal,
    );
    const payload = {
      summary: { id: args.deployment, name: args.deployment },
      info: result,
    };
    return structured(payload, { text: renderDeploymentInfo(payload) });
  },
});

export const createDeploymentTool = defineTool({
  name: "komodo_deployment_create",
  description: `Create a new Komodo deployment (Docker container).

REQUIRED: name
RECOMMENDED: server_id (target server) and image (what to deploy)

IMAGE FORMATS:
- Simple string: "nginx:latest", "ghcr.io/owner/repo:v1.0"
- Object format: { type: "Image", params: { image: "nginx:latest" } }
- Komodo Build: { type: "Build", params: { build_id: "..." } }`,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.ADMIN],
  input: z.object({
    name: resourceNameSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_NAME),
    server_id: serverIdSchema.optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_DEPLOY),
    image: DeploymentImageSchema.optional().describe("Docker image to deploy"),
    config: createDeploymentConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.DEPLOYMENT_CONFIG_CREATE),
  }),
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const deploymentConfig: Record<string, unknown> = { ...args.config };
    if (args.server_id) deploymentConfig.server_id = args.server_id;
    if (args.image) {
      deploymentConfig.image =
        typeof args.image === "string" ? { type: "Image", params: { image: args.image } } : args.image;
    }

    const result = await wrapApiCall(
      "createDeployment",
      () =>
        komodo.client.write("CreateDeployment", {
          name: args.name,
          config: deploymentConfig,
        }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "create", resourceType: "deployment", resourceId: args.name });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const updateDeploymentTool = defineTool({
  name: "komodo_deployment_update",
  description: `Update an existing Komodo deployment configuration.

PATCH-STYLE UPDATE: Only specify fields you want to change.

COMMON UPDATE SCENARIOS:
- Change image: { image: { type: "Image", params: { image: "nginx:1.25" } } }
- Update env vars: { environment: "NODE_ENV=production\\nPORT=3000" }
- Change ports: { ports: "8080:80\\n443:443" }
- Change restart policy: { restart: "always" }`,
  input: z.object({
    deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID_FOR_UPDATE),
    config: deploymentConfigSchema.describe(CONFIG_DESCRIPTIONS.DEPLOYMENT_CONFIG_PARTIAL),
  }),
  annotations: { idempotentHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "updateDeployment",
      // @type-variance — Zod-Output → komodo_client _PartialDeploymentConfig
      () =>
        komodo.client.write("UpdateDeployment", {
          id: args.deployment,
          config: args.config as Types._PartialDeploymentConfig,
        }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "update", resourceType: "deployment", resourceId: args.deployment });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const deleteDeploymentTool = defineTool({
  name: "komodo_deployment_delete",
  description:
    "Delete a Komodo deployment. Removes the deployment configuration and stops/removes the associated container.",
  input: z.object({
    deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteDeployment",
      () => komodo.client.write("DeleteDeployment", { id: args.deployment }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "remove", resourceType: "deployment", resourceId: args.deployment });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

// ============================================================================
// Lifecycle
// ============================================================================

/** Maps the action enum to the corresponding Komodo execute API name. */
const DEPLOYMENT_ACTION_API_MAP = {
  deploy: "Deploy",
  pull: "PullDeployment",
  start: "StartDeployment",
  restart: "RestartDeployment",
  pause: "PauseDeployment",
  unpause: "UnpauseDeployment",
  stop: "StopDeployment",
  destroy: "DestroyDeployment",
} as const satisfies Record<
  z.infer<typeof deploymentActionInputSchema>["action"],
  | "Deploy"
  | "PullDeployment"
  | "StartDeployment"
  | "RestartDeployment"
  | "PauseDeployment"
  | "UnpauseDeployment"
  | "StopDeployment"
  | "DestroyDeployment"
>;

export const deploymentActionTool = defineTool({
  name: "komodo_deployment_action",
  description:
    "Run a lifecycle action on a Komodo deployment: deploy (create or recreate the container), pull (latest image " +
    "without recreating), start, restart, pause, unpause, stop, or destroy (remove the container). " +
    "The `destroy` action is destructive (the container is removed); the deployment configuration is preserved.",
  input: deploymentActionInputSchema,
  output: actionResultSchema,
  annotations: { idempotentHint: true, destructiveHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = DEPLOYMENT_ACTION_API_MAP[args.action];
    const update = await wrapExecuteAndPoll(
      `${args.action} deployment`,
      () => komodo.client.execute(apiAction, { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "deployment", args.deployment);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});
