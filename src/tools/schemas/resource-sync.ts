/**
 * ResourceSync Schemas
 *
 * Zod schemas for Komodo ResourceSync (`komodo_resource_sync_*` tools).
 *
 * ResourceSync is Komodo's GitOps mechanism: a configured set of TOML files in
 * a git repo is reconciled against the running Komodo state.
 *
 * @module tools/schemas/resource-sync
 */

import { z } from "mcp-server-framework";
import { resourceNameSchema } from "./validators.js";
import { actionResultSchema, pageOutputSchema, resourceLinkSchema } from "./shared.js";

export const resourceSyncIdSchema = z.string().min(1);

export const resourceSyncSummarySchema = z.object({
  id: z.string().describe("ResourceSync ID"),
  name: z.string().describe("ResourceSync name"),
  state: z.string().optional().describe("Current sync state"),
  managed: z.boolean().optional().describe("True if this sync is fully managed (auto-applies)"),
  repo: z.string().optional().describe("Configured repository (namespace/name)"),
  branch: z.string().optional().describe("Configured branch"),
  resource_path: z.array(z.string()).optional().describe("Paths within the repo containing the TOML resource files"),
  last_sync_ts: z.number().int().optional().describe("Unix timestamp (ms) of last successful sync"),
  last_sync_hash: z.string().optional().describe("Short commit hash of last successful sync"),
});

export const resourceSyncListOutputSchema = z
  .object({
    items: z.array(resourceSyncSummarySchema).describe("ResourceSyncs registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered resource syncs");

export const resourceSyncInfoOutputSchema = z
  .object({
    summary: resourceSyncSummarySchema,
    info: z.unknown().optional().describe("Full resource sync payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed information about a resource sync");

export const resourceSyncActionOutputSchema = actionResultSchema;

/** Action enum for the consolidated `komodo_resource_sync_action` tool. */
export const resourceSyncActionEnum = z
  .enum(["run", "refresh"])
  .describe(
    "Lifecycle action: 'run' executes the sync (applies pending changes — long-running, polled). " +
      "'refresh' updates the pending-changes preview without applying anything.",
  );

export const resourceSyncActionInputSchema = z.object({
  action: resourceSyncActionEnum,
  resource_sync: resourceSyncIdSchema.describe("ResourceSync id or name"),
});

/**
 * Input for `komodo_resource_sync_apply` (create-or-update).
 *
 * Flat schema; the handler validates `name` for create and `resource_sync` for update at runtime.
 * `config` mirrors `Types.ResourceSyncConfig` — kept as an open record to avoid coupling
 * to upstream type evolution.
 */
export const resourceSyncApplyInputSchema = z.object({
  action: z
    .enum(["create", "update"])
    .describe("'create' to register a new resource sync, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new resource sync"),
  resource_sync: resourceSyncIdSchema
    .optional()
    .describe("Required when action='update' — existing resource sync id or name"),
  config: z
    .record(z.unknown())
    .optional()
    .describe(
      "ResourceSync configuration (repo, branch, resource_path[], file_contents, managed, etc.). " +
        "Only specify fields you want to set or update.",
    ),
});
