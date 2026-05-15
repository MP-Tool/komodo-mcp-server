/**
 * Update Tools (read-only)
 *
 * Tools for querying Komodo's update history. Updates are the audit log of all
 * operations performed by Komodo (deploys, builds, syncs, …).
 *
 * Tools (2):
 * - `komodo_update_list` — list updates (paginated, filterable by operation/target)
 * - `komodo_update_info` — full update payload including per-stage logs
 *
 * Note: ListUpdates uses **page-based** pagination on the Komodo backend (not cursor-based).
 * We expose `cursor` as an opaque string that encodes the next page number for API-shape consistency.
 *
 * @module tools/update
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { requireClient, wrapApiCall, renderUpdateList, renderUpdateInfo, tryRegisterResource } from "../utils/index.js";
import {
  updateIdSchema,
  updateListOutputSchema,
  updateInfoOutputSchema,
  updateListInputSchema,
} from "./schemas/index.js";
import { inlineFullInputSchema } from "./schemas/index.js";

type UpdateListItem = Types.UpdateListItem;
type UpdateFull = Types.Update;

function projectListItem(u: UpdateListItem) {
  return {
    id: u.id,
    operation: u.operation,
    status: u.status,
    success: u.success,
    start_ts: u.start_ts,
    target_type: u.target.type,
    ...(u.target.id ? { target_id: u.target.id } : {}),
    ...(u.username ? { username: u.username } : {}),
  };
}

function projectFullSummary(u: UpdateFull) {
  return {
    id: u._id?.$oid ?? "",
    operation: u.operation,
    status: u.status,
    success: u.success,
    start_ts: u.start_ts,
    ...(u.end_ts !== undefined ? { end_ts: u.end_ts } : {}),
    target_type: u.target.type,
    ...(u.target.id ? { target_id: u.target.id } : {}),
    ...(u.operator ? { username: u.operator } : {}),
  };
}

// ============================================================================
// List
// ============================================================================

export const listUpdatesTool = defineTool({
  name: "komodo_update_list",
  description:
    "List Komodo update history (audit log of operations like Deploy/RunBuild/RunSync). Newest first. Supports filtering by operation name and resource target. Pagination uses an opaque cursor string (Komodo backend is page-based).",
  input: updateListInputSchema,
  output: updateListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.UPDATE },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();

    // Decode opaque cursor → page number (Komodo's pagination model is integer page index).
    let page: number | undefined;
    if (args.cursor !== undefined) {
      const n = Number(args.cursor);
      if (Number.isFinite(n) && n >= 0) page = Math.floor(n);
    }

    // Build a Mongo-style query for the optional filters.
    const query: Record<string, unknown> = {};
    if (args.operation) query["operation"] = args.operation;
    if (args.target_type) query["target.type"] = args.target_type;
    if (args.target_id) query["target.id"] = args.target_id;

    // @type-variance — Komodo SDK types `query` as `MongoDocument`; a plain record is accepted at runtime.
    const params: Types.ListUpdates = {
      ...(page !== undefined && { page }),
      ...(Object.keys(query).length > 0 && { query: query as Types.MongoDocument }),
    };

    const result = await wrapApiCall("listUpdates", () => komodo.client.read("ListUpdates", params), abortSignal);

    const allItems = result.updates.map(projectListItem);
    // Respect requested page_size by truncating; Komodo's server-side page size is fixed (~20).
    const limit = args.page_size ?? allItems.length;
    const items = allItems.slice(0, limit);

    const pageInfo = result.next_page !== undefined ? { next_cursor: String(result.next_page) } : undefined;

    const payload = { items, ...(pageInfo && { page: pageInfo }) };
    return structured(payload, { text: renderUpdateList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getUpdateInfoTool = defineTool({
  name: "komodo_update_info",
  description: "Get the full update payload for a single operation, including per-stage logs (stdout/stderr).",
  input: z
    .object({
      id: updateIdSchema,
    })
    .merge(inlineFullInputSchema),
  output: updateInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.UPDATE },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall("getUpdate", () => komodo.client.read("GetUpdate", { id: args.id }), abortSignal);
    const summary = projectFullSummary(result);
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `Update ${summary.id || args.id} (${summary.operation})`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full update payload with per-stage logs`,
    });
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderUpdateInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});
