/**
 * Repo Schemas
 *
 * Zod schemas for Komodo Repo resources (`komodo_repo_*` tools).
 *
 * @module tools/schemas/repo
 */

import { z } from "mcp-server-framework";
import { PARAM_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from "../../config/index.js";
import { resourceNameSchema } from "./validators.js";
import { actionResultSchema, pageOutputSchema, resourceLinkSchema, systemCommandSchema } from "./shared.js";

export const repoIdSchema = z.string().min(1);

export const repoSummarySchema = z.object({
  id: z.string().describe("Repo ID"),
  name: z.string().describe("Repo name"),
  state: z.string().optional().describe("Repo state when known"),
  server_id: z.string().optional().describe("Attached server resource ID"),
  builder_id: z.string().optional().describe("Attached builder resource ID"),
  repo: z.string().optional().describe("Configured repository (namespace/name)"),
  branch: z.string().optional().describe("Configured branch"),
  cloned_hash: z.string().optional().describe("Short commit hash currently cloned"),
  built_hash: z.string().optional().describe("Short commit hash last built"),
  latest_hash: z.string().optional().describe("Latest known remote short commit hash"),
  last_pulled_at: z.number().int().optional().describe("Unix timestamp (ms) of last clone/pull"),
  last_built_at: z.number().int().optional().describe("Unix timestamp (ms) of last build"),
});

export const repoListOutputSchema = z
  .object({
    items: z.array(repoSummarySchema).describe("Repos registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered repos");

export const repoInfoOutputSchema = z
  .object({
    summary: repoSummarySchema,
    info: z.unknown().optional().describe("Full repo resource payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed information about a repo");

export const repoActionOutputSchema = actionResultSchema;

/** Repo lifecycle actions for the consolidated `komodo_repo_action` tool */
export const repoActionEnum = z
  .enum(["clone", "pull", "build", "cancel_build"])
  .describe(
    "Lifecycle action: clone (initial git clone on attached server), pull (git pull), build (run repo build via builder), cancel_build (cancel an in-progress build).",
  );

/** Input schema for the consolidated `komodo_repo_action` tool */
export const repoActionInputSchema = z.object({
  action: repoActionEnum,
  repo: repoIdSchema.describe("Repo id or name"),
});

/** Repo configuration — all fields optional (partial by design). Mirrors `Types.RepoConfig`. */
export const repoConfigSchema = z
  .object({
    server_id: z.string().optional().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    builder_id: z.string().optional().describe("Builder ID to attach — required for `komodo_repo_action` with `build`"),
    git_provider: z.string().optional().describe('Git provider domain. Default: "github.com"'),
    git_https: z.boolean().optional().describe("Use HTTPS for git clone (vs HTTP). Default: true"),
    git_account: z
      .string()
      .optional()
      .describe("Git account name for private repo access (must be configured in Komodo)"),
    repo: z.string().optional().describe("Repository path: {namespace}/{repo_name}"),
    branch: z.string().optional().describe('Git branch to track. Default: "main"'),
    commit: z.string().optional().describe("Pin to a specific commit hash (overrides branch tip)"),
    path: z
      .string()
      .optional()
      .describe("Clone destination — absolute path used directly; relative path resolved from periphery repo_dir"),
    webhook_enabled: z.boolean().optional().describe("Whether incoming webhooks trigger action. Default: true"),
    webhook_secret: z
      .string()
      .optional()
      .describe("Custom webhook secret — empty string falls back to the global default"),
    on_clone: systemCommandSchema
      .optional()
      .describe("Command to run after initial clone (path relative to repo root)"),
    on_pull: systemCommandSchema.optional().describe("Command to run after each pull (path relative to repo root)"),
    links: z.array(z.string()).optional().describe("Quick links displayed in the resource header (URLs)"),
    environment: z
      .string()
      .optional()
      .describe("Inline env vars written to env_file_path (KEY=value, one per line). Empty string skips file write."),
    env_file_path: z.string().optional().describe('Env file path relative to repo root. Default: ".env"'),
    skip_secret_interp: z.boolean().optional().describe("Skip Komodo secret interpolation into the env file"),
  })
  .describe("Repo configuration — only specify fields you want to set or update");

/**
 * Discriminated input for `komodo_repo_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Repo (`name` required)
 * - `action: "update"` — PATCH-style update of an existing Repo (`repo` required)
 */
/**
 * Input for `komodo_repo_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `repo` for update at runtime.
 */
export const repoApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' to register a new repo, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new repo"),
  repo: repoIdSchema.optional().describe("Required when action='update' — existing repo id or name"),
  config: repoConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.REPO_CONFIG_PARTIAL),
});
