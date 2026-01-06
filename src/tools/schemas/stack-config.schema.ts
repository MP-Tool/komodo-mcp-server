/**
 * Stack Configuration Schema
 *
 * This file defines the Zod schema for Komodo Stack (Docker Compose) configuration.
 * Based on the official Komodo types: StackConfig and _PartialStackConfig
 */

import { z } from 'zod';
import { PARAM_DESCRIPTIONS, FIELD_DESCRIPTIONS } from '../../config/descriptions.js';

/**
 * System command configuration for pre/post deploy hooks
 */
export const SystemCommandSchema = z
  .object({
    path: z.string().optional().describe('Working directory for the command'),
    command: z.string().optional().describe('The shell command to execute'),
  })
  .describe('System command configuration');

/**
 * Additional environment file configuration
 */
export const AdditionalEnvFileSchema = z
  .object({
    path: z.string().describe('Path to the env file relative to run directory'),
    contents: z.string().optional().describe('Contents of the env file (if defined in UI)'),
  })
  .describe('Additional environment file');

/**
 * Stack file dependency configuration
 */
export const StackFileDependencySchema = z
  .object({
    path: z.string().describe('Path to the config file relative to run directory'),
    contents: z.string().optional().describe('Contents of the file (if defined in UI)'),
  })
  .describe('Additional config file to track');

/**
 * Partial Stack Configuration Schema
 *
 * All fields are optional for update operations (PATCH-style updates).
 * Only the fields you want to change need to be specified.
 *
 * Stacks support two modes:
 * 1. Compose Mode (server_id): Uses docker compose on a single server
 * 2. Swarm Mode (swarm_id): Deploys as a Docker Swarm stack
 */
export const PartialStackConfigSchema = z
  .object({
    // === Server/Swarm Assignment ===
    server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_COMPOSE),
    swarm_id: z
      .string()
      .optional()
      .describe(`${PARAM_DESCRIPTIONS.SWARM_ID}. If both are set, swarm_id takes precedence.`),

    // === Quick Links ===
    links: z.array(z.string()).optional().describe('Quick links displayed in the resource header (URLs)'),

    // === Project Configuration ===
    project_name: z
      .string()
      .optional()
      .describe('Custom project name for docker compose -p. Defaults to stack name. Use to import existing stacks.'),

    // === Deployment Behavior ===
    auto_pull: z
      .boolean()
      .optional()
      .describe('Automatically run "docker compose pull" before deploying (Compose mode only)'),
    run_build: z.boolean().optional().describe('Run "docker compose build" before deploying (Compose mode only)'),
    poll_for_updates: z.boolean().optional().describe('Poll for newer image versions'),
    auto_update: z
      .boolean()
      .optional()
      .describe('Automatically redeploy when newer images are found (implies poll_for_updates)'),
    auto_update_all_services: z
      .boolean()
      .optional()
      .describe('Redeploy entire stack on auto-update (vs only services with updates)'),
    destroy_before_deploy: z.boolean().optional().describe('Run "docker compose down" before "up"'),
    skip_secret_interp: z.boolean().optional().describe('Skip secret interpolation into environment variables'),

    // === Git Repository Configuration ===
    linked_repo: z.string().optional().describe('Komodo Repo resource name/ID to source compose files from'),
    git_provider: z.string().optional().describe('Git provider domain. Default: "github.com"'),
    git_https: z.boolean().optional().describe('Use HTTPS for git clone. Default: true'),
    git_account: z.string().optional().describe('Git account name for private repo access'),
    repo: z.string().optional().describe('Repository path: {namespace}/{repo_name} (e.g., "owner/my-stack")'),
    branch: z.string().optional().describe('Git branch to use. Default: "main"'),
    commit: z.string().optional().describe('Specific commit hash to checkout'),
    clone_path: z.string().optional().describe('Custom path for cloning the repository'),
    reclone: z.boolean().optional().describe('Delete and reclone instead of git pull'),

    // === Webhook Configuration ===
    webhook_enabled: z.boolean().optional().describe('Enable incoming webhooks to trigger deployments'),
    webhook_secret: z.string().optional().describe('Custom webhook secret (empty = use default from config)'),
    webhook_force_deploy: z.boolean().optional().describe('Force deploy on webhook (vs DeployStackIfChanged)'),

    // === File Configuration ===
    files_on_host: z.boolean().optional().describe('Source compose files from host filesystem instead of UI/git'),
    run_directory: z.string().optional().describe('Working directory for docker compose commands'),
    file_paths: z
      .array(z.string())
      .optional()
      .describe('Compose file paths relative to run directory. Default: ["compose.yaml"]'),
    env_file_path: z.string().optional().describe('Path for environment file. Default: ".env" (Compose mode only)'),
    additional_env_files: z
      .array(AdditionalEnvFileSchema)
      .optional()
      .describe('Additional env files to attach with --env-file'),
    config_files: z
      .array(StackFileDependencySchema)
      .optional()
      .describe('Additional config files to track for UI editing and change detection'),

    // === Alerts ===
    send_alerts: z.boolean().optional().describe('Send StackStateChange alerts for this stack'),

    // === Registry Configuration ===
    registry_provider: z.string().optional().describe('Registry provider for docker login before compose up'),
    registry_account: z.string().optional().describe('Registry account for docker login'),

    // === Hooks ===
    pre_deploy: SystemCommandSchema.optional().describe('Command to run before stack deployment'),
    post_deploy: SystemCommandSchema.optional().describe('Command to run after stack deployment'),

    // === Extra Arguments ===
    extra_args: z
      .array(z.string())
      .optional()
      .describe(
        'Extra arguments for deploy command. Compose: "docker compose up -d [EXTRA_ARGS]". Swarm: "docker stack deploy [EXTRA_ARGS] STACK"',
      ),
    build_extra_args: z
      .array(z.string())
      .optional()
      .describe('Extra arguments for "docker compose build" (only if run_build is true, Compose mode only)'),
    compose_cmd_wrapper: z
      .string()
      .optional()
      .describe(
        'Command wrapper for secrets management. Use [[COMPOSE_COMMAND]] as placeholder. Example: "op run -- [[COMPOSE_COMMAND]]" (1password)',
      ),

    // === Service Configuration ===
    ignore_services: z
      .array(z.string())
      .optional()
      .describe('Services to ignore when checking stack health (e.g., init containers)'),

    // === Compose File Contents ===
    file_contents: z
      .string()
      .optional()
      .describe(`${FIELD_DESCRIPTIONS.FILE_CONTENTS} Supports variable/secret interpolation.`),

    // === Environment Variables ===
    environment: z
      .string()
      .optional()
      .describe(`${FIELD_DESCRIPTIONS.ENVIRONMENT} Written to env_file_path before compose up. (Compose mode only)`),
  })
  .describe('Partial stack configuration - only specify fields you want to update');

/**
 * Schema for creating a new stack
 */
export const CreateStackConfigSchema = PartialStackConfigSchema.extend({
  server_id: z.string().optional().describe(`${PARAM_DESCRIPTIONS.SERVER_ID_FOR_DEPLOY}`),
});

/**
 * Utility type exports for TypeScript consumers
 */
export type PartialStackConfig = z.infer<typeof PartialStackConfigSchema>;
export type CreateStackConfig = z.infer<typeof CreateStackConfigSchema>;
