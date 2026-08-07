/**
 * Tag Schemas
 *
 * Zod schemas for Komodo Tag resources (`komodo_tag_*` tools). Tags are labels
 * attached to resources for filtering/grouping. Field names mirror `Types.Tag` /
 * `TagColor` / `CreateTag` / `RenameTag` / `UpdateTagColor` / `DeleteTag`.
 *
 * @module tools/schemas/tag
 */

import { z } from "zod";
import { Types } from "komodo_client";
import { resourceNameSchema } from "./validators.js";
import { pageOutputSchema } from "./shared.js";

/** Tag identifier (id or name) accepted by the Komodo API. */
export const tagIdSchema = z.string().min(1);

/** Tag color — mirrors `Types.TagColor` (a large string enum). Used for OUTPUT (what Komodo returns). */
export const tagColorSchema = z.nativeEnum(Types.TagColor);

/** Every valid tag color, for input validation + guidance. */
export const TAG_COLOR_VALUES = Object.values(Types.TagColor) as string[];

/**
 * Resolve free-text color input to a `TagColor`, or `null` if unknown (case-sensitive).
 * Input is taken as a plain string (not a 54-value enum) so MCP clients render a normal
 * text field instead of an oversized dropdown; the handler validates fail-closed.
 */
export function parseTagColor(input: string): Types.TagColor | null {
  return TAG_COLOR_VALUES.includes(input) ? (input as Types.TagColor) : null;
}

/** Human-facing hint describing the color naming scheme (for `.describe()` + errors). */
export const TAG_COLOR_HINT =
  'Named <Shade><Base>, e.g. "Blue", "DarkRed", "LightGreen". Shade ∈ {Light, "", Dark}; Base ∈ {Slate, Red, Orange, Amber, Yellow, Lime, Green, Emerald, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Fuchsia, Pink, Rose}. Default: Slate.';

/** Compact summary of a single tag. Tags are tiny — this doubles as the full resource. */
export const tagSummarySchema = z.object({
  id: z.string().describe("Tag ID"),
  name: z.string().describe("Tag name"),
  owner: z.string().optional().describe("User ID that owns this tag, if set"),
  color: tagColorSchema.optional().describe("Display color"),
});

export const tagListOutputSchema = z
  .object({
    items: z.array(tagSummarySchema).describe("Tags registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered tags");

export const tagInfoOutputSchema = z.object({ tag: tagSummarySchema }).describe("Full tag resource");

/**
 * Input for `komodo_tag_apply` (create-or-update). Flat so MCP Inspector renders a form.
 * On update, renaming (`RenameTag`) and recoloring (`UpdateTagColor`) are separate API
 * calls; the handler dispatches to one or both based on which of `name`/`color` is set.
 */
export const tagApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' a new tag, or 'update' to rename/recolor an existing one"),
  name: resourceNameSchema
    .optional()
    .describe("Required for create — the new tag name. For update, provide to rename the tag."),
  tag: tagIdSchema.optional().describe("Required for update — existing tag id or name"),
  color: z
    .string()
    .optional()
    .describe(
      `Display color. For create: initial color (default Slate). For update: recolor the tag. ${TAG_COLOR_HINT}`,
    ),
});
