/**
 * Deployment Schemas
 *
 * Zod schemas for deployment configuration including image sources,
 * restart policies, and container settings.
 *
 * @module tools/schemas/deployment
 */

import { z } from "mcp-server-framework";
import { Types } from "komodo_client";
import {
  PARAM_DESCRIPTIONS,
  FIELD_DESCRIPTIONS,
  RESTART_MODE_DESCRIPTIONS,
  CONFIG_DESCRIPTIONS,
} from "../../config/index.js";
import { deploymentIdSchema, serverIdSchema, resourceNameSchema } from "./validators.js";
import { resourceLinkSchema, pageOutputSchema } from "./shared.js";

/** Container restart policy */
const restartModeSchema = z
  .nativeEnum(Types.RestartMode)
  .describe(
    `Container restart policy: "no" (${RESTART_MODE_DESCRIPTIONS.NO}), "on-failure" (${RESTART_MODE_DESCRIPTIONS.ON_FAILURE}), "always" (${RESTART_MODE_DESCRIPTIONS.ALWAYS}), "unless-stopped" (${RESTART_MODE_DESCRIPTIONS.UNLESS_STOPPED})`,
  );

/** Signal to send when stopping the container */
const terminationSignalSchema = z
  .nativeEnum(Types.TerminationSignal)
  .describe("Signal to send when stopping the container. Default: SIGTERM");

/** Image source: either an external Docker image or a Komodo Build */
export const DeploymentImageSchema = z
  .union([
    z.object({
      type: z.literal("Image").describe("Deploy an external Docker image"),
      params: z.object({
        image: z
          .string()
          .optional()
          .describe('Container image with tag (e.g., "nginx:latest", "ghcr.io/owner/repo:v1.0")'),
      }),
    }),
    z.object({
      type: z.literal("Build").describe("Deploy a Komodo Build"),
      params: z.object({
        build_id: z.string().optional().describe("The ID of the Komodo Build to deploy"),
        version: z
          .object({
            major: z.number().describe("Major version number"),
            minor: z.number().describe("Minor version number"),
            patch: z.number().describe("Patch version number"),
          })
          .optional()
          .describe('Specific version to deploy (0.0.0 means "latest")'),
      }),
    }),
  ])
  .describe("Image source: either an external Docker image or a Komodo Build");

/** Deployment configuration — all fields optional (partial by design) */
export const deploymentConfigSchema = z
  .object({
    server_id: z.string().optional().describe(`${PARAM_DESCRIPTIONS.SERVER_ID} to deploy the container on.`),
    swarm_id: z
      .string()
      .optional()
      .describe(`${PARAM_DESCRIPTIONS.SWARM_ID}. If both are set, swarm_id takes precedence.`),
    image: DeploymentImageSchema.optional(),
    image_registry_account: z.string().optional().describe("Account name for private registry authentication"),
    skip_secret_interp: z.boolean().optional().describe("Skip secret interpolation into environment variables"),
    redeploy_on_build: z.boolean().optional().describe("Automatically redeploy when attached Komodo Build finishes"),
    poll_for_updates: z.boolean().optional().describe("Poll for newer image versions"),
    auto_update: z.boolean().optional().describe("Automatically redeploy when newer image is found"),
    send_alerts: z.boolean().optional().describe("Send ContainerStateChange alerts for this deployment"),
    links: z.array(z.string()).optional().describe("Quick links displayed in the resource header (URLs)"),
    network: z.string().optional().describe(FIELD_DESCRIPTIONS.NETWORK_DEFAULT_HOST),
    restart: restartModeSchema.optional(),
    command: z.string().optional().describe("Command passed to the container. Leave empty for default."),
    replicas: z.number().int().min(0).optional().describe("Number of replicas (Swarm mode only). Default: 1"),
    termination_signal: terminationSignalSchema.optional(),
    termination_timeout: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Timeout in seconds before force-killing container"),
    extra_args: z.array(z.string()).optional().describe("Extra arguments for docker run/service create"),
    term_signal_labels: z.string().optional().describe("Labels for termination signal options"),
    ports: z.string().optional().describe(FIELD_DESCRIPTIONS.PORTS),
    volumes: z.string().optional().describe(FIELD_DESCRIPTIONS.VOLUMES),
    environment: z.string().optional().describe(FIELD_DESCRIPTIONS.ENVIRONMENT),
    labels: z.string().optional().describe(FIELD_DESCRIPTIONS.LABELS),
  })
  .describe("Deployment configuration - only specify fields you want to set or update");

/** Deployment creation config — extends base with create-specific overrides */
export const createDeploymentConfigSchema = deploymentConfigSchema.extend({
  server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_DEPLOY),
});

/** Deployment lifecycle actions for the consolidated `komodo_deployment_action` tool */
export const deploymentActionEnum = z
  .enum(["deploy", "pull", "start", "restart", "pause", "unpause", "stop", "destroy"])
  .describe(
    "Lifecycle action: deploy (create or re-deploy the container), pull (pull image without recreating), start (start a stopped container), restart (stop+start), pause/unpause (freeze/resume processes), stop (stop the container), destroy (remove the container).",
  );

/** Input schema for the consolidated `komodo_deployment_action` tool */
export const deploymentActionInputSchema = z.object({
  action: deploymentActionEnum,
  deployment: deploymentIdSchema.describe("Deployment ID or name"),
});

/**
 * Discriminated input for `komodo_deployment_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Deployment (`name` required, `server_id` and `image` recommended)
 * - `action: "update"` — PATCH-style update of an existing Deployment (`deployment` required)
 */
/**
 * Input for `komodo_deployment_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `deployment` for update at runtime.
 */
export const deploymentApplyInputSchema = z.object({
  action: z
    .enum(["create", "update"])
    .describe("'create' to register a new deployment, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new deployment"),
  deployment: deploymentIdSchema.optional().describe("Required when action='update' — existing deployment id or name"),
  server_id: serverIdSchema
    .optional()
    .describe("Convenience field for action='create' — target server (mirrors `config.server_id`)"),
  image: DeploymentImageSchema.optional().describe(
    "Convenience field for action='create' — Docker image to deploy (mirrors `config.image`)",
  ),
  config: deploymentConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.DEPLOYMENT_CONFIG_PARTIAL),
});

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single deployment as returned in list/info responses. */
export const deploymentSummarySchema = z.object({
  id: z.string().describe("Deployment ID"),
  name: z.string().describe("Deployment name"),
  state: z.string().optional().describe("Container state (running, exited, paused, ...) when known"),
  image: z.string().optional().describe("Image reference currently configured"),
  server_id: z.string().optional().describe("Target server ID"),
});

/** Output of `komodo_deployment_list`. */
export const deploymentListOutputSchema = z
  .object({
    items: z.array(deploymentSummarySchema).describe("Deployments visible to the caller"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of deployments");

/** Output of `komodo_deployment_info`. */
export const deploymentInfoOutputSchema = z
  .object({
    summary: deploymentSummarySchema,
    info: z.unknown().optional().describe("Full deployment resource payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed information about a deployment");
