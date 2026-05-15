/**
 * Stack Schemas
 *
 * Zod schemas for Docker Compose stack configuration including
 * git integration, webhooks, and deployment hooks.
 *
 * @module tools/schemas/stack
 */

import { z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, FIELD_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from "../../config/index.js";
import { stackIdSchema, serverIdSchema, resourceNameSchema } from "./validators.js";
import {
  systemCommandSchema,
  linkedRepoSchema,
  webhookSchema,
  resourceLinkSchema,
  pageOutputSchema,
} from "./shared.js";

/** Additional config file dependency for the Stack */
const stackConfigFileDependencySchema = z
  .object({
    path: z.string().describe("Path to the config file relative to run directory"),
    services: z.array(z.string()).optional().describe("Specific services this file applies to"),
    requires: z
      .nativeEnum(Types.StackFileRequires)
      .optional()
      .describe("Action required when file changes: Redeploy, Restart, or None (default)"),
  })
  .describe("Additional config file dependency for the Stack");

/** Stack configuration — all fields optional (partial by design) */
export const stackConfigSchema = z
  .object({
    server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_COMPOSE),
    swarm_id: z
      .string()
      .optional()
      .describe(`${PARAM_DESCRIPTIONS.SWARM_ID}. If both are set, swarm_id takes precedence.`),
    links: z.array(z.string()).optional().describe("Quick links displayed in the resource header (URLs)"),
    project_name: z.string().optional().describe("Custom project name for docker compose -p. Defaults to stack name."),
    auto_pull: z.boolean().optional().describe('Run "docker compose pull" before deploying (Compose mode only)'),
    run_build: z.boolean().optional().describe('Run "docker compose build" before deploying (Compose mode only)'),
    poll_for_updates: z.boolean().optional().describe("Poll for newer image versions"),
    auto_update: z.boolean().optional().describe("Automatically redeploy when newer images are found"),
    auto_update_all_services: z.boolean().optional().describe("Redeploy entire stack on auto-update"),
    destroy_before_deploy: z.boolean().optional().describe('Run "docker compose down" before "up"'),
    skip_secret_interp: z.boolean().optional().describe("Skip secret interpolation into environment variables"),
    files_on_host: z.boolean().optional().describe("Source compose files from host filesystem"),
    run_directory: z.string().optional().describe("Working directory for docker compose commands"),
    file_paths: z.array(z.string()).optional().describe('Compose file paths. Default: ["compose.yaml"]'),
    env_file_path: z.string().optional().describe('Path for environment file. Default: ".env"'),
    additional_env_files: z
      .array(
        z.object({
          path: z.string().describe("File path relative to run directory"),
          track: z
            .boolean()
            .describe(
              "Whether Komodo should track this file's contents. If true, Komodo will read, display, diff, and validate. If false, only passed via --env-file.",
            ),
        }),
      )
      .optional()
      .describe("Additional env file paths, attached with --env-file"),
    config_files: z.array(stackConfigFileDependencySchema).optional().describe("Additional config files to track"),
    send_alerts: z.boolean().optional().describe("Send StackStateChange alerts for this stack"),
    registry_provider: z.string().optional().describe("Registry provider for docker login"),
    registry_account: z.string().optional().describe("Registry account for docker login"),
    pre_deploy: systemCommandSchema.optional().describe("Command to run before stack deployment"),
    post_deploy: systemCommandSchema.optional().describe("Command to run after stack deployment"),
    extra_args: z.array(z.string()).optional().describe("Extra arguments for deploy command"),
    build_extra_args: z.array(z.string()).optional().describe('Extra arguments for "docker compose build"'),
    compose_cmd_wrapper: z.string().optional().describe("Command wrapper for secrets management"),
    compose_cmd_wrapper_include: z
      .array(z.string())
      .optional()
      .describe("Commands to include in the compose command wrapper (e.g. specific compose subcommands)"),
    ignore_services: z.array(z.string()).optional().describe("Services to ignore when checking stack health"),
    file_contents: z
      .string()
      .optional()
      .describe(`${FIELD_DESCRIPTIONS.FILE_CONTENTS} Supports variable/secret interpolation.`),
    environment: z
      .string()
      .optional()
      .describe(`${FIELD_DESCRIPTIONS.ENVIRONMENT} Written to env_file_path before compose up.`),
  })
  .merge(linkedRepoSchema)
  .merge(webhookSchema)
  .describe("Stack configuration - only specify fields you want to set or update");

/** Stack creation config — extends base with create-specific overrides */
export const createStackConfigSchema = stackConfigSchema.extend({
  server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID_FOR_DEPLOY),
});

/** Stack lifecycle actions for the consolidated `komodo_stack_action` tool */
export const stackActionEnum = z
  .enum(["deploy", "pull", "start", "restart", "pause", "unpause", "stop", "destroy"])
  .describe(
    "Lifecycle action: deploy (compose up / re-deploy), pull (pull latest images), start (compose start), restart (stop+start), pause/unpause (freeze/resume processes), stop (compose stop), destroy (compose down — removes containers).",
  );

/** Input schema for the consolidated `komodo_stack_action` tool */
export const stackActionInputSchema = z.object({
  action: stackActionEnum,
  stack: stackIdSchema.describe("Stack ID or name"),
});

/**
 * Discriminated input for `komodo_stack_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Stack (`name` required, `server_id` recommended)
 * - `action: "update"` — PATCH-style update of an existing Stack (`stack` required)
 */
/**
 * Input for `komodo_stack_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `stack` for update at runtime.
 */
export const stackApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' to register a new stack, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new stack"),
  stack: stackIdSchema.optional().describe("Required when action='update' — existing stack id or name"),
  server_id: serverIdSchema
    .optional()
    .describe("Convenience field for action='create' — target server (mirrors `config.server_id`)"),
  config: stackConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.STACK_CONFIG_PARTIAL),
});

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single stack as returned in list/info responses. */
export const stackSummarySchema = z.object({
  id: z.string().describe("Stack ID"),
  name: z.string().describe("Stack name"),
  state: z.string().optional().describe("Aggregate compose state (running, partial, stopped, ...) when known"),
  server_id: z.string().optional().describe("Target server ID"),
});

/** Output of `komodo_stack_list`. */
export const stackListOutputSchema = z
  .object({
    items: z.array(stackSummarySchema).describe("Stacks visible to the caller"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of stacks");

/** Output of `komodo_stack_info`. */
export const stackInfoOutputSchema = z
  .object({
    summary: stackSummarySchema,
    info: z.unknown().optional().describe("Full stack resource payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed information about a stack");
