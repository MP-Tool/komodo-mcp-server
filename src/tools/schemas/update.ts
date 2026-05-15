/**
 * Update Schemas
 *
 * Zod schemas for Komodo Update history (`komodo_update_*` tools, read-only).
 *
 * @module tools/schemas/update
 */

import { z } from "mcp-server-framework";
import { pageOutputSchema, resourceLinkSchema } from "./shared.js";

export const updateIdSchema = z.string().min(1).describe("Update id (MongoDB ObjectId hex)");

export const updateSummarySchema = z.object({
  id: z.string().describe("Update id"),
  operation: z.string().describe("Operation name (e.g. 'Deploy', 'RunBuild')"),
  status: z.string().describe("Current status (e.g. 'Complete', 'InProgress', 'Cancelled')"),
  success: z.boolean().optional().describe("Final success flag (only set when status='Complete')"),
  start_ts: z.number().int().optional().describe("Unix timestamp (ms) when the update started"),
  end_ts: z.number().int().optional().describe("Unix timestamp (ms) when the update completed"),
  target_type: z.string().optional().describe("Resource target type (e.g. 'Stack', 'Deployment', 'Build')"),
  target_id: z.string().optional().describe("Resource target id"),
  username: z.string().optional().describe("User who triggered the update"),
});

export const updateListOutputSchema = z
  .object({
    items: z.array(updateSummarySchema).describe("Update history items"),
    page: pageOutputSchema.optional(),
  })
  .describe("Update history");

export const updateInfoOutputSchema = z
  .object({
    summary: updateSummarySchema,
    info: z.unknown().optional().describe("Full update payload (with stage logs) when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed update information including per-stage logs");

export const updateListInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe("Opaque pagination cursor from a previous list call. Omit for the first page."),
  page_size: z.number().int().min(1).max(100).optional().describe("Maximum number of items to return (1-100)"),
  operation: z.string().optional().describe("Filter by operation name (e.g. 'Deploy', 'RunBuild')"),
  target_type: z
    .string()
    .optional()
    .describe("Filter by resource target type (e.g. 'Stack', 'Deployment', 'Build', 'Repo', 'Procedure')"),
  target_id: z.string().optional().describe("Filter by resource target id"),
});
