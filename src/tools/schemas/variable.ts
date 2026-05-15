/**
 * Variable Schemas
 *
 * Zod schemas for Komodo Variables (`komodo_variable_*` tools).
 *
 * @module tools/schemas/variable
 */

import { z } from "mcp-server-framework";
import { pageOutputSchema } from "./shared.js";

export const variableNameSchema = z.string().min(1).describe("Variable name (unique key)");

export const variableSummarySchema = z.object({
  name: z.string().describe("Variable name"),
  value: z
    .string()
    .describe("Variable value — empty string when the variable is marked as secret and the user lacks read access"),
  description: z.string().optional().describe("Optional human-readable description"),
  is_secret: z.boolean().optional().describe("True if the value is treated as a secret"),
});

export const variableListOutputSchema = z
  .object({
    items: z.array(variableSummarySchema).describe("Variables registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered variables");

export const variableInfoOutputSchema = z
  .object({
    variable: variableSummarySchema,
  })
  .describe("Detailed information about a variable");

/**
 * Input for `komodo_variable_apply` (create-or-update).
 *
 * Flat schema: name is always required; value/description/is_secret optional.
 * The handler dispatches based on `action` and validates required fields at runtime.
 */
export const variableApplyInputSchema = z.object({
  action: z
    .enum(["create", "update"])
    .describe(
      "'create' to register a new variable, 'update' to change an existing variable's value/description/is_secret",
    ),
  name: variableNameSchema,
  value: z.string().optional().describe("Variable value — required for action='create'; optional for update"),
  description: z.string().optional().describe("Optional description"),
  is_secret: z.boolean().optional().describe("If true, mark the variable as a secret (value redacted in responses)"),
});
