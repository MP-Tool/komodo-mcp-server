/**
 * Action Schemas
 *
 * Zod schemas for Komodo Action resources (`komodo_action_*` tools).
 *
 * An Action is a scheduled Deno/TypeScript script that runs against the
 * Komodo API using a pre-initialised `komodo` client. Actions support
 * CRON / English schedules, webhook triggers and per-run arguments.
 *
 * @module tools/schemas/action
 */

import { z } from "mcp-server-framework";
import { resourceNameSchema } from "./validators.js";
import { actionResultSchema, pageOutputSchema, resourceLinkSchema } from "./shared.js";

/** Action identifier (id or name) accepted by the Komodo API. */
export const actionIdSchema = z.string().min(1);

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single Action. */
export const actionSummarySchema = z.object({
  id: z.string().describe("Action ID"),
  name: z.string().describe("Action name"),
  state: z.string().optional().describe("Action state (Running, Ok, Failed, Unknown) when known"),
  last_run_at: z.number().int().optional().describe("Unix timestamp (ms) of the last successful run"),
  next_scheduled_run: z.number().int().optional().describe("Unix timestamp (ms) of the next scheduled run"),
  schedule_error: z.string().optional().describe("Error parsing the schedule expression, if any"),
});

/** Output of `komodo_action_list`. */
export const actionListOutputSchema = z
  .object({
    items: z.array(actionSummarySchema).describe("Actions registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered actions");

/** Output of `komodo_action_info`. */
export const actionInfoOutputSchema = z
  .object({
    summary: actionSummarySchema,
    info: z.unknown().optional().describe("Full Action resource (only when not offloaded as a resource link)"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Action summary + optional full resource");

/** Output of `komodo_action_action` (long-running run result). */
export const actionActionOutputSchema = actionResultSchema;

// ============================================================================
// Input Schemas — Action
// ============================================================================

export const actionActionEnum = z.enum(["run"]);
export type ActionAction = z.infer<typeof actionActionEnum>;

/** Flat input schema for `komodo_action_action`. */
export const actionActionInputSchema = z.object({
  action: actionActionEnum.describe("Action to perform."),
  action_id: actionIdSchema.describe("Action id or name to run"),
  args: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Optional custom arguments merged on top of the Action's default arguments (exposed as `ARGS` in the script)",
    ),
});

// ============================================================================
// Input Schemas — CRUD
// ============================================================================

/**
 * Action configuration — all fields optional (PATCH-style).
 * Mirrors `Types.ActionConfig`.
 */
export const actionConfigSchema = z
  .object({
    run_at_startup: z.boolean().optional().describe("Run this Action automatically at Komodo startup"),
    schedule_format: z
      .enum(["English", "Cron"])
      .optional()
      .describe("Schedule expression format — Cron expression or natural-language English"),
    schedule: z
      .string()
      .optional()
      .describe(
        'Schedule expression. CRON: `0 0 0 1,15 * ?`. English: "at midnight on the 1st and 15th of the month".',
      ),
    schedule_enabled: z.boolean().optional().describe("Whether the schedule is currently active"),
    schedule_timezone: z.string().optional().describe("TZ identifier; falls back to Core local timezone if empty"),
    schedule_alert: z.boolean().optional().describe("Send alerts when the schedule runs"),
    failure_alert: z.boolean().optional().describe("Send alerts when this Action fails"),
    webhook_enabled: z.boolean().optional().describe("Whether incoming webhooks trigger this Action"),
    webhook_secret: z.string().optional().describe("Custom webhook secret (empty falls back to global default)"),
    reload_deno_deps: z.boolean().optional().describe("Instruct Deno to reload all dependencies on each run"),
    file_contents: z
      .string()
      .optional()
      .describe(
        "TypeScript source for the Action. Runs in Deno with a pre-initialised `komodo` client; supports variable / secret interpolation.",
      ),
    arguments_format: z
      .enum(["key_value", "toml", "yaml", "json"])
      .optional()
      .describe("Format used to parse `arguments` (default: key_value, environment-style)"),
    arguments: z.string().optional().describe("Default arguments injected as `ARGS` into the Action script"),
  })
  .describe("Action configuration — only specify fields you want to set or update");

/**
 * Input for `komodo_action_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `action_id` for update at runtime.
 */
export const actionApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' to register a new Action, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new Action"),
  action_id: actionIdSchema.optional().describe("Required when action='update' — existing Action id or name"),
  config: actionConfigSchema.optional().describe("Action configuration (PATCH-style)"),
});
