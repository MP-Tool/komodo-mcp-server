/**
 * Shared Subschemas
 *
 * Cross-domain Zod subschemas reused across multiple tool domains.
 *
 * @module tools/schemas/shared
 */

import { z } from "mcp-server-framework";

/** Cursor-based pagination input for list tools. */
export const paginationInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe("Opaque pagination cursor returned by a previous list call. Omit for the first page."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return (1-100). Default: server-defined."),
});

/**
 * Inline-full toggle for detail tools.
 *
 * When `true`, the tool returns the full payload inline instead of a
 * compact summary. When `false` (default), a concise summary is returned.
 */
export const inlineFullInputSchema = z.object({
  inline_full: z
    .boolean()
    .optional()
    .describe("If true, return the full payload inline instead of a compact summary. Default: false."),
});

/** System command configuration (working directory + shell command). */
export const systemCommandSchema = z
  .object({
    path: z.string().optional().describe("Working directory for the command"),
    command: z.string().optional().describe("The shell command to execute"),
  })
  .describe("System command configuration");
