/**
 * Deployment Tools
 *
 * Tools for listing, managing, and controlling Komodo deployments (single-container applications).
 *
 * @module tools/deployment
 */

import { defineTool, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from "../config/index.js";
import {
  formatActionResponse,
  formatInfoResponse,
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  formatUpdateResult,
} from "../utils/index.js";
import {
  deploymentConfigSchema,
  createDeploymentConfigSchema,
  DeploymentImageSchema,
  deploymentIdSchema,
  resourceNameSchema,
} from "./schemas/index.js";

type DeploymentListItem = Types.DeploymentListItem;

// ============================================================================
// List
// ============================================================================

export const listDeploymentsTool = defineTool({
  name: "komodo_list_deployments",
  description:
    "List all Komodo-managed deployments. Deployments are single-container applications managed by Komodo. Shows deployment name, ID, and current state.",
  input: z.object({}),
  annotations: { readOnlyHint: true },
  handler: async (_args, { abortSignal }) => {
    const komodo = requireClient();
    const deployments = await wrapApiCall(
      "list deployments",
      () => komodo.client.read("ListDeployments", {}),
      abortSignal,
    );
    return text(
      `🚢 Deployments:\n\n${
        deployments.map((d: DeploymentListItem) => `• ${d.name} (${d.id}) - State: ${d.info.state}`).join("\n") ||
        "No deployments found."
      }`,
    );
  },
});

// ============================================================================
// Info / CRUD
// ============================================================================

export const getDeploymentInfoTool = defineTool({
  name: "komodo_get_deployment_info",
  description:
    "Get detailed information about a Komodo deployment including configuration, current state, container status, image, ports, volumes, and environment variables.",
  input: z.object({
    deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID_FOR_INFO),
  }),
  annotations: { readOnlyHint: true },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getDeploymentInfo",
      () => komodo.client.read("GetDeployment", { deployment: args.deployment }),
      abortSignal,
    );
    return text(
      formatInfoResponse({
        resourceType: "deployment",
        resourceId: args.deployment,
        content: JSON.stringify(result, null, 2),
      }),
    );
  },
});

export const createDeploymentTool = defineTool({
  name: "komodo_create_deployment",
  description: `Create a new Komodo deployment (Docker container).

REQUIRED: name
RECOMMENDED: server_id (target server) and image (what to deploy)

IMAGE FORMATS:
- Simple string: "nginx:latest", "ghcr.io/owner/repo:v1.0"
- Object format: { type: "Image", params: { image: "nginx:latest" } }
- Komodo Build: { type: "Build", params: { build_id: "..." } }`,
  annotations: { idempotentHint: false },
  input: z.object({
    name: resourceNameSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_NAME),
    server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_DEPLOY),
    image: z
      .union([z.string().describe('Docker image (e.g., "nginx:latest")'), DeploymentImageSchema])
      .optional()
      .describe("Docker image to deploy"),
    config: createDeploymentConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.DEPLOYMENT_CONFIG_CREATE),
  }),
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const deploymentConfig: Record<string, unknown> = { ...args.config };

    if (args.server_id) deploymentConfig.server_id = args.server_id;

    if (args.image) {
      if (typeof args.image === "string") {
        deploymentConfig.image = { type: "Image", params: { image: args.image } };
      } else {
        deploymentConfig.image = args.image;
      }
    }

    const result = await wrapApiCall(
      "createDeployment",
      () => komodo.client.write("CreateDeployment", { name: args.name, config: deploymentConfig }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "create", resourceType: "deployment", resourceId: args.name });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const updateDeploymentTool = defineTool({
  name: "komodo_update_deployment",
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
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "updateDeployment",
      // @type-variance — Zod .partial() output includes `| undefined` per field, komodo_client Partial<> does not
      () =>
        komodo.client.write("UpdateDeployment", { id: args.deployment, config: args.config as Types.DeploymentConfig }),
      abortSignal,
    );
    const header = formatActionResponse({ action: "update", resourceType: "deployment", resourceId: args.deployment });
    return text(`${header}\n\n${JSON.stringify(result, null, 2)}`);
  },
});

export const deleteDeploymentTool = defineTool({
  name: "komodo_delete_deployment",
  description:
    "Delete (unregister) a Komodo deployment. Removes the deployment configuration but does not affect running containers.",
  input: z.object({
    deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  annotations: { destructiveHint: true },
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
// Actions (deploy, pull, start, restart, pause, unpause, stop, destroy)
// ============================================================================

export const deployContainerTool = defineTool({
  name: "komodo_deploy_container",
  description:
    "Deploy or redeploy a Komodo-managed deployment. Pulls the configured image and (re)creates the container.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "deploy",
      () => komodo.client.execute("Deploy", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "deploy", "deployment", args.deployment));
  },
});

export const pullDeploymentImageTool = defineTool({
  name: "komodo_pull_deployment_image",
  description: "Pull the latest image for a deployment without recreating the container.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "pull",
      () => komodo.client.execute("PullDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "pull", "deployment", args.deployment));
  },
});

export const startDeploymentTool = defineTool({
  name: "komodo_start_deployment",
  description: "Start a stopped Komodo-managed deployment.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "start deployment",
      () => komodo.client.execute("StartDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "start", "deployment", args.deployment));
  },
});

export const restartDeploymentTool = defineTool({
  name: "komodo_restart_deployment",
  description: "Restart a Komodo-managed deployment without pulling a new image.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "restart deployment",
      () => komodo.client.execute("RestartDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "restart", "deployment", args.deployment));
  },
});

export const pauseDeploymentTool = defineTool({
  name: "komodo_pause_deployment",
  description: "Pause a running Komodo-managed deployment.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "pause deployment",
      () => komodo.client.execute("PauseDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "pause", "deployment", args.deployment));
  },
});

export const unpauseDeploymentTool = defineTool({
  name: "komodo_unpause_deployment",
  description: "Unpause a paused Komodo-managed deployment.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "unpause deployment",
      () => komodo.client.execute("UnpauseDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "unpause", "deployment", args.deployment));
  },
});

export const stopDeploymentTool = defineTool({
  name: "komodo_stop_deployment",
  description: "Stop a running Komodo-managed deployment.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "stop deployment",
      () => komodo.client.execute("StopDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "stop", "deployment", args.deployment));
  },
});

export const destroyDeploymentTool = defineTool({
  name: "komodo_destroy_deployment",
  description:
    "Destroy (remove) the container of a Komodo-managed deployment. The deployment configuration is preserved.",
  input: z.object({ deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID) }),
  annotations: { destructiveHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "destroy deployment",
      () => komodo.client.execute("DestroyDeployment", { deployment: args.deployment }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "destroy", "deployment", args.deployment));
  },
});
