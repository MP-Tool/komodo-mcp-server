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
import {
  requireClient,
  requireKomodoPermission,
  wrapApiCall,
  renderUpdateList,
  renderUpdateInfo,
  tryRegisterResource,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
} from "../utils/index.js";
import {
  updateIdSchema,
  updateListOutputSchema,
  updateInfoOutputSchema,
  updateListInputSchema,
} from "./schemas/index.js";
import { inlineFullInputSchema } from "./schemas/index.js";

type UpdateListItem = Types.UpdateListItem;
type UpdateFull = Types.Update;

/**
 * Position in Komodo's update log: which server-side page, and how far into it.
 *
 * Both coordinates are needed because Komodo pages in fixed blocks of 100 while
 * this tool serves `page_size` items — see the handler for what goes wrong when
 * only the page number is carried.
 */
interface UpdateCursor {
  readonly page: number;
  readonly offset: number;
}

/**
 * Encode an {@link UpdateCursor} as an opaque string (base64 of `page:offset`).
 *
 * Exported for the round-trip test only — the format is opaque to callers and
 * may change; nothing outside this module should construct or read one.
 */
export function encodeUpdateCursor(page: number, offset: number): string {
  return Buffer.from(`${page}:${offset}`, "utf8").toString("base64");
}

/**
 * Decode an opaque update cursor, tolerating anything malformed by starting over.
 *
 * Also accepts the bare page number this tool emitted before the offset existed,
 * so cursors held by a client across an upgrade keep working (they resume at the
 * start of that page rather than failing).
 */
export function decodeUpdateCursor(cursor: string | undefined): UpdateCursor {
  if (cursor === undefined) return { page: 0, offset: 0 };

  const legacyPage = Number(cursor);
  if (Number.isInteger(legacyPage) && legacyPage >= 0) return { page: legacyPage, offset: 0 };

  try {
    const [rawPage, rawOffset] = Buffer.from(cursor, "base64").toString("utf8").split(":");
    const page = Number(rawPage);
    const offset = Number(rawOffset);
    if (Number.isInteger(page) && page >= 0 && Number.isInteger(offset) && offset >= 0) return { page, offset };
  } catch {
    /* fall through to the first page */
  }
  return { page: 0, offset: 0 };
}

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
    // @sdk-constraint — Update.end_ts is Option<I64> in Komodo Core, serialized as JSON null
    // while an update is still running; the komodo_client TS type (`end_ts?: I64`) hides that.
    ...(u.end_ts != null ? { end_ts: u.end_ts } : {}),
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

    // Two pagination models meet here. Komodo serves whole pages of
    // UPDATES_PER_PAGE (100, hard-coded in Core), while this tool hands out
    // `page_size` items like every other list tool. The cursor therefore has to
    // carry BOTH coordinates: which Komodo page, and how far into it we already
    // are. Encoding only the page number silently skipped the remainder of each
    // page — with page_size=25, 75 of every 100 audit entries were unreachable.
    const { page, offset } = decodeUpdateCursor(args.cursor);

    // Build a Mongo-style query for the optional filters.
    const query: Record<string, unknown> = {};
    if (args.operation) query["operation"] = args.operation;
    if (args.target_type) query["target.type"] = args.target_type;
    if (args.target_id) query["target.id"] = args.target_id;

    // @type-variance — Komodo SDK types `query` as `MongoDocument`; a plain record is accepted at runtime.
    const params: Types.ListUpdates = {
      ...(page > 0 && { page }),
      ...(Object.keys(query).length > 0 && { query: query as Types.MongoDocument }),
    };

    const result = await wrapApiCall("listUpdates", () => komodo.client.read("ListUpdates", params), abortSignal);

    const pageItems = result.updates.map(projectListItem);
    const size = Math.min(Math.max(args.page_size ?? DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
    const end = offset + size;
    const items = pageItems.slice(offset, end);

    // @sdk-constraint — next_page is Option<u32> in Komodo Core: JSON null on the last page
    // (the TS type hides that). `!== undefined` would turn that into a bogus next page forever.
    const hasNextKomodoPage = result.next_page != null;
    // Stay on this Komodo page while it still has items; only then move on.
    const nextCursor =
      end < pageItems.length
        ? encodeUpdateCursor(page, end)
        : hasNextKomodoPage
          ? encodeUpdateCursor(result.next_page as number, 0)
          : undefined;

    const payload = { items, ...(nextCursor !== undefined && { page: { next_cursor: nextCursor } }) };
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
    // Post-fetch check: the target resource is only known once the Update is read (there's
    // no way to know which resource an update id refers to beforehand). Defense-in-depth before
    // returning log content — the wrapApiCall 403 backstop already covers the read above.
    await requireKomodoPermission(result.target, Types.PermissionLevel.Read);
    const summary = projectFullSummary(result);
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `Update ${summary.id || args.id} (${summary.operation})`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
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
