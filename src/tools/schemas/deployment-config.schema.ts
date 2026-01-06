/**
 * Deployment Configuration Schema
 *
 * This file defines the Zod schema for Komodo Deployment configuration.
 * Based on the official Komodo types: DeploymentConfig and _PartialDeploymentConfig
 *
 * @see https://docs.komo.do
 */

import { z } from 'zod';

/**
 * Restart mode options for Docker containers
 */
export const RestartModeSchema = z
  .enum(['no', 'on-failure', 'always', 'unless-stopped'])
  .describe(
    'Container restart policy: "no" (never restart), "on-failure" (restart on non-zero exit), "always" (always restart), "unless-stopped" (restart unless manually stopped)',
  );

/**
 * Termination signal options
 */
export const TerminationSignalSchema = z
  .enum(['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGTERM'])
  .describe('Signal to send when stopping the container. Default: SIGTERM');

/**
 * Deployment image configuration - supports external images or Komodo Builds
 *
 * Two formats:
 * 1. External Image: { type: "Image", params: { image: "nginx:latest" } }
 * 2. Komodo Build: { type: "Build", params: { build_id: "...", version: { major: 1, minor: 0, patch: 0 } } }
 */
export const DeploymentImageSchema = z
  .union([
    z.object({
      type: z.literal('Image').describe('Deploy an external Docker image'),
      params: z.object({
        image: z.string().optional().describe('Docker image with tag (e.g., "nginx:latest", "ghcr.io/owner/repo:v1.0")'),
      }),
    }),
    z.object({
      type: z.literal('Build').describe('Deploy a Komodo Build'),
      params: z.object({
        build_id: z.string().optional().describe('The ID of the Komodo Build to deploy'),
        version: z
          .object({
            major: z.number().describe('Major version number'),
            minor: z.number().describe('Minor version number'),
            patch: z.number().describe('Patch version number'),
          })
          .optional()
          .describe('Specific version to deploy (0.0.0 means "latest")'),
      }),
    }),
  ])
  .describe('Image source: either an external Docker image or a Komodo Build');

/**
 * Partial Deployment Configuration Schema
 *
 * All fields are optional for update operations (PATCH-style updates).
 * Only the fields you want to change need to be specified.
 */
export const PartialDeploymentConfigSchema = z
  .object({
    // === Server/Swarm Assignment ===
    server_id: z
      .string()
      .optional()
      .describe('Server ID or name to deploy the container on. Use this for single-server deployments.'),
    swarm_id: z
      .string()
      .optional()
      .describe(
        'Swarm ID to deploy as a Swarm Service. If both swarm_id and server_id are set, swarm_id takes precedence.',
      ),

    // === Image Configuration ===
    image: DeploymentImageSchema.optional(),
    image_registry_account: z
      .string()
      .optional()
      .describe('Account name for private registry authentication (used with docker login)'),

    // === Deployment Behavior ===
    skip_secret_interp: z.boolean().optional().describe('Skip secret interpolation into environment variables'),
    redeploy_on_build: z.boolean().optional().describe('Automatically redeploy when attached Komodo Build finishes'),
    poll_for_updates: z.boolean().optional().describe('Poll for newer image versions'),
    auto_update: z
      .boolean()
      .optional()
      .describe('Automatically redeploy when newer image is found (implies poll_for_updates)'),
    send_alerts: z.boolean().optional().describe('Send ContainerStateChange alerts for this deployment'),

    // === Quick Links ===
    links: z.array(z.string()).optional().describe('Quick links displayed in the resource header (URLs)'),

    // === Container Configuration ===
    network: z.string().optional().describe('Docker network to attach. Default: "host"'),
    restart: RestartModeSchema.optional(),
    command: z
      .string()
      .optional()
      .describe(
        'Command passed to the container (appended after docker run). Leave empty for default container command.',
      ),
    replicas: z.number().int().min(0).optional().describe('Number of replicas (Swarm mode only). Default: 1'),
    termination_signal: TerminationSignalSchema.optional(),
    termination_timeout: z.number().int().min(0).optional().describe('Timeout in seconds before force-killing container'),
    extra_args: z
      .array(z.string())
      .optional()
      .describe('Extra arguments for docker run/service create (e.g., ["--privileged", "--cap-add=NET_ADMIN"])'),
    term_signal_labels: z
      .string()
      .optional()
      .describe('Labels for termination signal options (different shutdown behavior per signal)'),

    // === Port Mapping ===
    ports: z.string().optional().describe('Port mappings in docker format. Example: "8080:80\\n443:443"'),

    // === Volume Mapping ===
    volumes: z.string().optional().describe('Volume mappings in docker format. Example: "/host/data:/container/data\\n./config:/app/config:ro"'),

    // === Environment Variables ===
    environment: z
      .string()
      .optional()
      .describe('Environment variables in KEY=VALUE format, one per line. Example: "NODE_ENV=production\\nPORT=3000"'),

    // === Container Labels ===
    labels: z.string().optional().describe('Docker labels in KEY=VALUE format, one per line. Example: "traefik.enable=true\\ncom.example.version=1.0"'),
  })
  .describe('Partial deployment configuration - only specify fields you want to update');

/**
 * Schema for creating a new deployment
 * Some fields have different defaults for create vs update
 */
export const CreateDeploymentConfigSchema = PartialDeploymentConfigSchema.extend({
  // server_id is typically required for new deployments
  server_id: z.string().optional().describe('Server ID or name to deploy on (required unless using swarm_id)'),
});

/**
 * Utility type exports for TypeScript consumers
 */
export type PartialDeploymentConfig = z.infer<typeof PartialDeploymentConfigSchema>;
export type CreateDeploymentConfig = z.infer<typeof CreateDeploymentConfigSchema>;
export type DeploymentImage = z.infer<typeof DeploymentImageSchema>;
