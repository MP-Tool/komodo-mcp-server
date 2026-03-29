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
import { PARAM_DESCRIPTIONS, FIELD_DESCRIPTIONS, RESTART_MODE_DESCRIPTIONS } from "../../config/index.js";

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
