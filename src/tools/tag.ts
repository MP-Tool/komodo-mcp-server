/**
 * Tag Tools
 *
 * Manage Komodo Tags — labels attached to resources for filtering/grouping.
 *
 * Tools (4): list / info / apply (create-or-update) / delete.
 *
 * Tags are global metadata (no per-resource permission target), so writes are gated by the `ADMIN` scope;
 * delete requires destructive confirmation. On update, rename (`RenameTag`) and recolor
 * (`UpdateTagColor`) are separate API calls dispatched by which of name/color is provided.
 *
 * No admin pre-check here on purpose: Komodo Core permits non-admins to manage Tags unless the
 * operator sets `disable_non_admin_create`, so demanding admin would refuse users Komodo allows.
 * Core stays the authority; the tools only make sure the touched tag reaches the audit trail.
 *
 * @module tools/tag
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  recordAffected,
  requireDestructiveConfirmation,
  wrapApiCall,
  buildApplyResult,
  buildDeleteResult,
  paginate,
  renderTagList,
  renderTagInfo,
} from "../utils/index.js";
import {
  tagIdSchema,
  tagListOutputSchema,
  tagInfoOutputSchema,
  tagApplyInputSchema,
  parseTagColor,
  TAG_COLOR_HINT,
  applyResultSchema,
  deleteResultSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type Tag = Types.Tag;

/** Validate free-text color input fail-closed, returning a `TagColor` or throwing a helpful error. */
function requireTagColor(input: string): Types.TagColor {
  const color = parseTagColor(input);
  if (!color) {
    throw AppErrorFactory.validation.custom(`Unknown tag color "${input}". ${TAG_COLOR_HINT}`, "color");
  }
  return color;
}

function projectTag(t: Tag): { id: string; name: string; owner?: string; color?: Types.TagColor } {
  return {
    id: t._id?.$oid ?? t.name,
    name: t.name,
    ...(t.owner !== undefined && t.owner !== "" ? { owner: t.owner } : {}),
    ...(t.color !== undefined ? { color: t.color } : {}),
  };
}

/**
 * `RenameTag`/`UpdateTagColor`/`DeleteTag` require the literal Mongo ObjectId (passing a name
 * fails). `GetTag` resolves either, so resolve the id first — keeping the tool's `tag` field
 * name-or-id, matching every other domain.
 */
async function resolveTagObjectId(tag: string, abortSignal: AbortSignal): Promise<string> {
  const komodo = requireClient();
  const result = await wrapApiCall("getTag", () => komodo.client.read("GetTag", { tag }), abortSignal);
  return result._id?.$oid ?? tag;
}

// ============================================================================
// List / Info
// ============================================================================

export const listTagsTool = defineTool({
  name: "komodo_tag_list",
  description: "List all tags registered in Komodo. Tags are labels attached to resources for filtering/grouping.",
  input: paginationInputSchema,
  output: tagListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.TAG },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const tags = await wrapApiCall("listTags", () => komodo.client.read("ListTags", {}), abortSignal);
    const allItems = tags.map(projectTag);
    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderTagList(payload) });
  },
});

export const getTagInfoTool = defineTool({
  name: "komodo_tag_info",
  description: "Get the full Komodo Tag resource (id, name, owner, color). Tags are small — always returned inline.",
  input: z.object({ tag: tagIdSchema.describe("Tag id or name") }),
  output: tagInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.TAG },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall("getTag", () => komodo.client.read("GetTag", { tag: args.tag }), abortSignal);
    const payload = { tag: projectTag(result) };
    return structured(payload, { text: renderTagInfo(payload) });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyTagTool = defineTool({
  name: "komodo_tag_apply",
  description: [
    "Create or update a Komodo Tag. Tags label resources for filtering/grouping.",
    'action="create": new tag. Required: name. Optional: color (default Slate).',
    'action="update": existing tag (`tag` required). Provide `name` to rename and/or `color` to recolor — at least one; each triggers its own API call (there is no combined update endpoint).',
  ].join("\n"),
  input: tagApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.TAG },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    recordAffected("Tag", args.tag ?? args.name ?? "<new>");
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const params: Types.CreateTag = {
        name,
        ...(args.color !== undefined && { color: requireTagColor(args.color) }),
      };
      const result = await wrapApiCall("createTag", () => komodo.client.write("CreateTag", params), abortSignal);
      const built = buildApplyResult("create", "tag", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.tag) throw AppErrorFactory.validation.fieldRequired("tag");
    if (args.name === undefined && args.color === undefined) {
      throw AppErrorFactory.validation.fieldRequired("name | color");
    }
    const tagId = await resolveTagObjectId(args.tag, abortSignal);
    let updated: Tag | undefined;
    if (args.name !== undefined) {
      const name = args.name;
      updated = await wrapApiCall(
        "renameTag",
        () => komodo.client.write("RenameTag", { id: tagId, name }),
        abortSignal,
      );
    }
    if (args.color !== undefined) {
      const color = requireTagColor(args.color);
      updated = await wrapApiCall(
        "updateTagColor",
        () => komodo.client.write("UpdateTagColor", { tag: tagId, color }),
        abortSignal,
      );
    }
    const built = buildApplyResult("update", "tag", args.tag, updated);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteTagTool = defineTool({
  name: "komodo_tag_delete",
  description: "Delete a Komodo Tag. Also removes this tag from every resource it was attached to.",
  input: z.object({ tag: tagIdSchema.describe("Tag id or name to delete") }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.TAG },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    recordAffected("Tag", args.tag);
    await requireDestructiveConfirmation({ action: "delete", resourceType: "tag", resourceId: args.tag });
    const tagId = await resolveTagObjectId(args.tag, abortSignal);
    const result = await wrapApiCall("deleteTag", () => komodo.client.write("DeleteTag", { id: tagId }), abortSignal);
    const built = buildDeleteResult("tag", args.tag, result);
    return structured(built.payload, { text: built.text });
  },
});
