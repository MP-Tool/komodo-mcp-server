/**
 * Procedure Tools
 *
 * Tools for managing Komodo Procedure resources.
 *
 * Tools (5):
 * - `komodo_procedure_list`   — list registered procedures
 * - `komodo_procedure_info`   — full procedure resource
 * - `komodo_procedure_action` — run a procedure (long-running, polls Update)
 * - `komodo_procedure_apply`  — create-or-update (discriminated by `action`)
 * - `komodo_procedure_delete` — unregister a procedure
 *
 * @module tools/procedure
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  paginate,
  renderProcedureList,
  renderProcedureInfo,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  procedureIdSchema,
  procedureListOutputSchema,
  procedureInfoOutputSchema,
  procedureActionInputSchema,
  procedureActionOutputSchema,
  procedureApplyInputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type ProcedureListItem = Types.ProcedureListItem;

// ============================================================================
// List
// ============================================================================

export const listProceduresTool = defineTool({
  name: "komodo_procedure_list",
  description:
    "List all procedures registered in Komodo. A procedure is a multi-stage workflow that can be triggered manually or on a schedule.",
  input: paginationInputSchema,
  output: procedureListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.PROCEDURE },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const procedures = await wrapApiCall("listProcedures", () => komodo.client.read("ListProcedures", {}), abortSignal);

    const allItems = procedures.map((p: ProcedureListItem) => ({
      id: p.id,
      name: p.name,
      state: p.info.state,
      stages: p.info.stages,
      ...(p.info.last_run_at !== undefined ? { last_run_at: p.info.last_run_at } : {}),
      ...(p.info.next_scheduled_run !== undefined ? { next_scheduled_run: p.info.next_scheduled_run } : {}),
      ...(p.info.schedule_error ? { schedule_error: p.info.schedule_error } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderProcedureList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getProcedureInfoTool = defineTool({
  name: "komodo_procedure_info",
  description: "Get the full Komodo Procedure resource (configuration, stages, schedule).",
  input: z
    .object({
      procedure: procedureIdSchema.describe("Procedure id or name"),
    })
    .merge(inlineFullInputSchema),
  output: procedureInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.PROCEDURE },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getProcedure",
      () => komodo.client.read("GetProcedure", { procedure: args.procedure }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (procedure info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full procedure resource for ${result.name}`,
    });
    const summary = {
      id: result._id?.$oid ?? args.procedure,
      name: result.name,
    };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderProcedureInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Action
// ============================================================================

export const procedureActionTool = defineTool({
  name: "komodo_procedure_action",
  description:
    "Procedure action. action='run': run a Komodo Procedure end-to-end (long-running — polls until the underlying Update reaches Complete and returns the per-stage logs).",
  input: procedureActionInputSchema,
  output: procedureActionOutputSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
  _meta: { category: ToolCategories.PROCEDURE },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      `${args.action} procedure '${args.procedure}'`,
      () => komodo.client.execute("RunProcedure", { procedure: args.procedure }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "procedure", args.procedure);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyProcedureTool = defineTool({
  name: "komodo_procedure_apply",
  description: [
    "Create or update a Komodo Procedure (PATCH-style). A procedure is a multi-stage workflow run manually or on schedule.",
    'action="create": new procedure. Required: name.',
    'action="update": existing procedure (`procedure` required). Only fields in `config` change.',
  ].join("\n"),
  input: procedureApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.PROCEDURE },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const result = await wrapApiCall(
        "createProcedure",
        // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<ProcedureConfig>` (`T`).
        () =>
          komodo.client.write("CreateProcedure", {
            name,
            config: (args.config ?? {}) as Types._PartialProcedureConfig,
          }),
        abortSignal,
      );
      const built = buildApplyResult("create", "procedure", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.procedure) throw AppErrorFactory.validation.fieldRequired("procedure");
    const procedureId = args.procedure;
    const result = await wrapApiCall(
      "updateProcedure",
      // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<ProcedureConfig>` (`T`).
      () =>
        komodo.client.write("UpdateProcedure", {
          id: procedureId,
          config: args.config as Types._PartialProcedureConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "procedure", procedureId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteProcedureTool = defineTool({
  name: "komodo_procedure_delete",
  description: "Unregister a Procedure from Komodo. Cancels any future scheduled runs.",
  input: z.object({
    procedure: procedureIdSchema.describe("Procedure id or name to delete"),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.PROCEDURE },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteProcedure",
      () => komodo.client.write("DeleteProcedure", { id: args.procedure }),
      abortSignal,
    );
    const built = buildDeleteResult("procedure", args.procedure, result);
    return structured(built.payload, { text: built.text });
  },
});
