/**
 * Procedure Schemas
 *
 * Zod schemas for Komodo Procedure resources (`komodo_procedure_*` tools).
 *
 * @module tools/schemas/procedure
 */

import { z } from "mcp-server-framework";
import { resourceNameSchema } from "./validators.js";
import { actionResultSchema, pageOutputSchema, resourceLinkSchema } from "./shared.js";

/** Procedure identifier (id or name) accepted by the Komodo API. */
export const procedureIdSchema = z.string().min(1);

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single procedure as returned in list/info responses. */
export const procedureSummarySchema = z.object({
  id: z.string().describe("Procedure ID"),
  name: z.string().describe("Procedure name"),
  state: z.string().optional().describe("Procedure state (Running, Ok, Failed, Unknown) when known"),
  stages: z.number().int().optional().describe("Number of stages this procedure has"),
  last_run_at: z.number().int().optional().describe("Unix timestamp (ms) of the last successful run"),
  next_scheduled_run: z.number().int().optional().describe("Unix timestamp (ms) of the next scheduled run"),
  schedule_error: z.string().optional().describe("Error parsing the schedule expression, if any"),
});

/** Output of `komodo_procedure_list`. */
export const procedureListOutputSchema = z
  .object({
    items: z.array(procedureSummarySchema).describe("Procedures registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered procedures");

/** Output of `komodo_procedure_info`. */
export const procedureInfoOutputSchema = z
  .object({
    summary: procedureSummarySchema,
    info: z.unknown().optional().describe("Full Procedure resource (only when not offloaded as a resource link)"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Procedure summary + optional full resource");

/** Output of `komodo_procedure_action` (long-running action result). */
export const procedureActionOutputSchema = actionResultSchema;

/**
 * Discriminator for `komodo_procedure_action`.
 *
 * Currently a single verb (`run`); the action shape exists for naming consistency
 * with the other `*_action` tools and to allow future extension (e.g. `cancel`).
 */
export const procedureActionEnum = z.enum(["run"]);
export type ProcedureAction = z.infer<typeof procedureActionEnum>;

/** Flat input schema for `komodo_procedure_action`. */
export const procedureActionInputSchema = z.object({
  action: procedureActionEnum.describe("Action to perform on the procedure."),
  procedure: procedureIdSchema.describe("Procedure id or name"),
});

/** Single execution within a stage (`Types.EnabledExecution`). */
export const enabledExecutionSchema = z
  .object({
    enabled: z.boolean().describe("Whether this execution runs as part of the stage"),
    execution: z
      .object({
        type: z
          .string()
          .describe(
            "Execution variant (e.g. RunBuild, Deploy, RunProcedure, StartContainer, PullStack, …) — one of Komodo's `Execution` discriminated-union variants",
          ),
        params: z.record(z.string(), z.unknown()).describe("Parameters specific to the chosen execution variant"),
      })
      .describe("Discriminated `Execution` payload — see Komodo SDK `Execution` type"),
  })
  .describe("Single execution entry inside a procedure stage");

/** Single procedure stage (`Types.ProcedureStage`). */
export const procedureStageSchema = z
  .object({
    name: z.string().describe("Stage name"),
    enabled: z.boolean().describe("Whether the stage is run as part of the procedure"),
    executions: z.array(enabledExecutionSchema).optional().describe("Executions run in parallel within this stage"),
  })
  .describe("A single stage of a procedure");

/** Procedure configuration — all fields optional (partial by design). Mirrors `Types.ProcedureConfig`. */
export const procedureConfigSchema = z
  .object({
    stages: z
      .array(procedureStageSchema)
      .optional()
      .describe("Stages run sequentially; executions inside a stage run in parallel"),
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
    failure_alert: z.boolean().optional().describe("Send alerts when this procedure fails"),
    webhook_enabled: z.boolean().optional().describe("Whether incoming webhooks trigger this procedure"),
    webhook_secret: z.string().optional().describe("Custom webhook secret (empty falls back to global default)"),
  })
  .describe("Procedure configuration — only specify fields you want to set or update");

/**
 * Discriminated input for `komodo_procedure_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Procedure (`name` required)
 * - `action: "update"` — PATCH-style update of an existing Procedure (`procedure` required)
 */
/**
 * Input for `komodo_procedure_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `procedure` for update at runtime.
 */
export const procedureApplyInputSchema = z.object({
  action: z
    .enum(["create", "update"])
    .describe("'create' to register a new procedure, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new procedure"),
  procedure: procedureIdSchema.optional().describe("Required when action='update' — existing procedure id or name"),
  config: procedureConfigSchema.optional().describe("Procedure configuration (all fields optional, PATCH-style)"),
});
