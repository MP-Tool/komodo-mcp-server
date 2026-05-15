/**
 * Alerter Tools
 *
 * Tools for managing Komodo Alerter resources (alert sinks: Slack, Discord, Custom HTTP, ...).
 *
 * Tools (4):
 * - `komodo_alerter_list`   — list registered alerters
 * - `komodo_alerter_info`   — full alerter resource (endpoint URL/headers offloaded via ResourceLink)
 * - `komodo_alerter_apply`  — create-or-update (discriminated by `action`)
 * - `komodo_alerter_delete` — unregister an alerter
 *
 * @module tools/alerter
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  paginate,
  renderAlerterList,
  renderAlerterInfo,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  alerterIdSchema,
  alerterListOutputSchema,
  alerterInfoOutputSchema,
  alerterApplyInputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type AlerterListItem = Types.AlerterListItem;

// ============================================================================
// List
// ============================================================================

export const listAlertersTool = defineTool({
  name: "komodo_alerter_list",
  description:
    "List all alerters registered in Komodo. Alerters are sinks (Slack, Discord, Custom HTTP, ...) that receive alerts when monitored resources change state.",
  input: paginationInputSchema,
  output: alerterListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.ALERTER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const alerters = await wrapApiCall("listAlerters", () => komodo.client.read("ListAlerters", {}), abortSignal);

    const allItems = alerters.map((a: AlerterListItem) => ({
      id: a.id,
      name: a.name,
      enabled: a.info.enabled,
      endpoint_type: a.info.endpoint_type,
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderAlerterList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getAlerterInfoTool = defineTool({
  name: "komodo_alerter_info",
  description:
    "Get the full Komodo Alerter resource (endpoint configuration, alert filters, maintenance windows). Sensitive fields like webhook URLs are offloaded via a session-scoped resource link when available.",
  input: z
    .object({
      alerter: alerterIdSchema.describe("Alerter id or name"),
    })
    .merge(inlineFullInputSchema),
  output: alerterInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.ALERTER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getAlerter",
      () => komodo.client.read("GetAlerter", { alerter: args.alerter }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (alerter info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full alerter resource for ${result.name}`,
    });
    const summary = {
      id: result._id?.$oid ?? args.alerter,
      name: result.name,
      ...(result.config?.enabled !== undefined ? { enabled: result.config.enabled } : {}),
      ...(result.config?.endpoint?.type ? { endpoint_type: result.config.endpoint.type } : {}),
    };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderAlerterInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyAlerterTool = defineTool({
  name: "komodo_alerter_apply",
  description: [
    "Create or update a Komodo Alerter (PATCH-style). Alerters route monitoring alerts to external sinks (Slack, Discord, custom HTTP, ...).",
    'action="create": new alerter. Required: name. Provide `config.endpoint` with discriminated `type` and provider params.',
    'action="update": existing alerter (`alerter` required). Only fields in `config` change.',
  ].join("\n"),
  input: alerterApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.ALERTER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const result = await wrapApiCall(
        "createAlerter",
        // @type-variance — Zod-inferred optional fields → SDK `_PartialAlerterConfig` (discriminated `endpoint` union).
        () =>
          komodo.client.write("CreateAlerter", {
            name,
            config: (args.config ?? {}) as unknown as Types._PartialAlerterConfig,
          }),
        abortSignal,
      );
      const built = buildApplyResult("create", "alerter", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.alerter) throw AppErrorFactory.validation.fieldRequired("alerter");
    const alerterId = args.alerter;
    const result = await wrapApiCall(
      "updateAlerter",
      // @type-variance — Zod-inferred optional fields → SDK `_PartialAlerterConfig` (discriminated `endpoint` union).
      () =>
        komodo.client.write("UpdateAlerter", {
          id: alerterId,
          config: args.config as unknown as Types._PartialAlerterConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "alerter", alerterId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteAlerterTool = defineTool({
  name: "komodo_alerter_delete",
  description: "Unregister an Alerter from Komodo. Future alerts that would have been routed here are dropped.",
  input: z.object({
    alerter: alerterIdSchema.describe("Alerter id or name to delete"),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.ALERTER },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteAlerter",
      () => komodo.client.write("DeleteAlerter", { id: args.alerter }),
      abortSignal,
    );
    const built = buildDeleteResult("alerter", args.alerter, result);
    return structured(built.payload, { text: built.text });
  },
});
