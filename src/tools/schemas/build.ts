/**
 * Build Schemas
 *
 * Zod schemas for Komodo Build resources (`komodo_build_*` tools).
 *
 * @module tools/schemas/build
 */

import { z } from "mcp-server-framework";
import { resourceNameSchema } from "./validators.js";
import {
  actionResultSchema,
  pageOutputSchema,
  resourceLinkSchema,
  systemCommandSchema,
  versionSchema,
  imageRegistryConfigSchema,
} from "./shared.js";

/** Build identifier (id or name) accepted by the Komodo API. */
export const buildIdSchema = z.string().min(1);

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single build as returned in list/info responses. */
export const buildSummarySchema = z.object({
  id: z.string().describe("Build ID"),
  name: z.string().describe("Build name"),
  state: z.string().optional().describe("Build state (Building, Ok, Failed, Unknown) when known"),
  version: z.string().optional().describe("Current build version (e.g. 1.4.0)"),
  builder_id: z.string().optional().describe("Attached builder resource ID"),
  repo: z.string().optional().describe("Source repository (namespace/name)"),
  branch: z.string().optional().describe("Git branch"),
  last_built_at: z.number().int().optional().describe("Unix timestamp (ms) of the last build run"),
});

/** Output of `komodo_build_list`. */
export const buildListOutputSchema = z
  .object({
    items: z.array(buildSummarySchema).describe("Builds registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered builds");

/** Output of `komodo_build_info`. */
export const buildInfoOutputSchema = z
  .object({
    summary: buildSummarySchema,
    info: z.unknown().optional().describe("Full build resource payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed information about a build");

/** Output of `komodo_build_action`. */
export const buildActionOutputSchema = actionResultSchema;

/** Build action discriminator (run or cancel). */
export const buildActionEnum = z
  .enum(["run", "cancel"])
  .describe(
    "Build lifecycle action: `run` triggers a new build (long-running, polled until Complete), `cancel` aborts an in-progress build (fire-and-forget).",
  );

/** Input schema for the consolidated `komodo_build_action` tool. */
export const buildActionInputSchema = z.object({
  action: buildActionEnum,
  build: buildIdSchema.describe("Build id or name"),
});

/** Build configuration — all fields optional (partial by design). Mirrors `Types.BuildConfig`. */
export const buildConfigSchema = z
  .object({
    builder_id: z.string().optional().describe("Builder resource ID used to run the build"),
    version: versionSchema.optional().describe("Current build version"),
    auto_increment_version: z.boolean().optional().describe("Auto-increment patch on every build. Default: true"),
    image_name: z.string().optional().describe("Override pushed image name (defaults to build name)"),
    image_tag: z.string().optional().describe("Extra tag suffix appended after the build version (e.g. 'aarch64')"),
    include_latest_tag: z.boolean().optional().describe("Push :latest / :latest-image_tag tags"),
    include_version_tags: z.boolean().optional().describe("Push semver :MAJOR.MINOR.PATCH and :MAJOR.MINOR tags"),
    include_commit_tag: z.boolean().optional().describe("Push commit-hash tag (e.g. :a6v8h83)"),
    links: z.array(z.string()).optional().describe("Quick links displayed in the resource header (URLs)"),
    linked_repo: z.string().optional().describe("Komodo Repo resource to source build files from"),
    git_provider: z.string().optional().describe('Git provider domain. Default: "github.com"'),
    git_https: z.boolean().optional().describe("Use HTTPS for git clone. Default: true"),
    git_account: z.string().optional().describe("Git account name for private repo access"),
    repo: z.string().optional().describe("Source repository: {namespace}/{repo_name}"),
    branch: z.string().optional().describe('Git branch to build. Default: "main"'),
    commit: z.string().optional().describe("Pin to a specific commit hash"),
    webhook_enabled: z.boolean().optional().describe("Whether incoming webhooks trigger action"),
    webhook_secret: z.string().optional().describe("Custom webhook secret (empty falls back to global default)"),
    files_on_host: z.boolean().optional().describe("Source build files from host filesystem instead of git/UI"),
    build_path: z.string().optional().describe('Docker build context path relative to repo root. Default: "."'),
    dockerfile_path: z.string().optional().describe("Dockerfile path relative to build_path"),
    image_registry: z
      .array(imageRegistryConfigSchema)
      .optional()
      .describe("Registries to push the built image to (first entry is used for attached Deployments)"),
    skip_secret_interp: z.boolean().optional().describe("Skip secret interpolation in build_args"),
    use_buildx: z.boolean().optional().describe("Use `docker buildx build` instead of `docker build`"),
    extra_args: z.array(z.string()).optional().describe("Extra arguments forwarded to docker build"),
    pre_build: systemCommandSchema.optional().describe("Command run after repo clone and before docker build"),
    dockerfile: z
      .string()
      .optional()
      .describe("Inline UI-defined dockerfile contents (supports variable / secret interpolation)"),
    build_args: z
      .string()
      .optional()
      .describe("Newline-separated KEY=value docker build args (visible in final image)"),
    secret_args: z
      .string()
      .optional()
      .describe(
        "Newline-separated KEY=value secret build args (mounted via `--mount=type=secret`, hidden in final image)",
      ),
    labels: z.string().optional().describe("Newline-separated KEY=value docker labels"),
  })
  .describe("Build configuration — only specify fields you want to set or update");

/**
 * Discriminated input for `komodo_build_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Build (`name` required)
 * - `action: "update"` — PATCH-style update of an existing Build (`build` required)
 */
/**
 * Input for `komodo_build_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `build` for update at runtime.
 */
export const buildApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' to register a new build, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new build"),
  build: buildIdSchema.optional().describe("Required when action='update' — existing build id or name"),
  config: buildConfigSchema.optional().describe("Build configuration (all fields optional, PATCH-style)"),
});

export const buildLogEntrySchema = z.object({
  stage: z.string().describe("Pipeline stage label (e.g. Clone, Build, Push)"),
  command: z.string().describe("Command that was executed"),
  success: z.boolean().describe("Whether the command exited successfully"),
  stdout: z.string().describe("Captured stdout (may be truncated)"),
  stderr: z.string().describe("Captured stderr (may be truncated)"),
  start_ts: z.number().int().describe("Start time (Unix ms)"),
  end_ts: z.number().int().describe("End time (Unix ms)"),
});

/** Output of `komodo_build_logs`. */
export const buildLogsOutputSchema = z
  .object({
    summary: buildSummarySchema,
    update_id: z.string().describe("Komodo Update ID providing these logs"),
    success: z.boolean().describe("Overall success of the build run"),
    status: z.string().describe("Update status (Complete, InProgress, Queued)"),
    logs: z.array(buildLogEntrySchema).optional().describe("Per-stage log entries from the build run"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Build run log output");
