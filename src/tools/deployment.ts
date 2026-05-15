/**
 * Deployment Tools
 *
 * Tools for managing single-container Komodo deployments.
 *
 * Tools (5):
 * - `komodo_deployment_list`    — list deployments
 * - `komodo_deployment_info`    — detailed deployment information
 * - `komodo_deployment_apply`   — create-or-update (discriminated by `action`)
 * - `komodo_deployment_delete`  — remove deployment from Komodo
 * - `komodo_deployment_action`  — consolidated lifecycle (deploy/pull/start/restart/pause/unpause/stop/destroy)
 *
 * @module tools/deployment
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
  renderDeploymentList,
  renderDeploymentInfo,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  deploymentApplyInputSchema,
  deploymentActionInputSchema,
  deploymentIdSchema,
  deploymentListOutputSchema,
  deploymentInfoOutputSchema,
  actionResultSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
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
  input: paginationInputSchema,
  output: deploymentListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const deployments = await wrapApiCall(
      "list deployments",
      () => komodo.client.read("ListDeployments", {}),
      abortSignal,
    );
    const allItems = deployments.map((d: DeploymentListItem) => ({
      id: d.id,
      name: d.name,
      state: d.info.state,
      ...(d.info.server_id ? { server_id: d.info.server_id } : {}),
    }));
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
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
  input: z
    .object({
      deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID_FOR_INFO),
    })
    .merge(inlineFullInputSchema),
  output: deploymentInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getDeployment",
      () => komodo.client.read("GetDeployment", { deployment: args.deployment }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${args.deployment} (deployment info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full deployment resource for ${args.deployment}`,
    });
    const summary = { id: args.deployment, name: args.deployment };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderDeploymentInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

export const applyDeploymentTool = defineTool({
  name: "komodo_deployment_apply",
  description: [
    "Create or update a Komodo deployment (Docker container, PATCH-style).",
    'action="create": new deployment. Required: name. Recommended: server_id, image.',
    'action="update": existing deployment (`deployment` required). Only fields in `config` change.',
    'Image accepts a string ("nginx:1.25") or { type: "Image"|"Build", params: {…} }.',
  ].join("\n"),
  input: deploymentApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.DEPLOYMENT },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const deploymentConfig: Record<string, unknown> = { ...args.config };
      if (args.server_id) deploymentConfig.server_id = args.server_id;
      if (args.image) {
        deploymentConfig.image =
          typeof args.image === "string" ? { type: "Image", params: { image: args.image } } : args.image;
      }
      const result = await wrapApiCall(
        "createDeployment",
        () => komodo.client.write("CreateDeployment", { name, config: deploymentConfig }),
        abortSignal,
      );
      const built = buildApplyResult("create", "deployment", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.deployment) throw AppErrorFactory.validation.fieldRequired("deployment");
    const deploymentId = args.deployment;
    const result = await wrapApiCall(
      "updateDeployment",
      // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<DeploymentConfig>` (`T`).
      () =>
        komodo.client.write("UpdateDeployment", {
          id: deploymentId,
          config: args.config as Types._PartialDeploymentConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "deployment", deploymentId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteDeploymentTool = defineTool({
  name: "komodo_deployment_delete",
  description:
    "Delete a Komodo deployment. Removes the deployment configuration and stops/removes the associated container.",
  input: z.object({
    deployment: deploymentIdSchema.describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
  }),
  output: deleteResultSchema,
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
    const built = buildDeleteResult("deployment", args.deployment, result);
    return structured(built.payload, { text: built.text });
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
    "Lifecycle action on a deployment: deploy (recreate container), pull (image only), start, restart, pause, unpause, stop, destroy (remove container). destroy is destructive; config preserved.",
  input: deploymentActionInputSchema,
  output: actionResultSchema,
  annotations: { readOnlyHint: false, idempotentHint: false, destructiveHint: true },
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
