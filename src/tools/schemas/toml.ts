/**
 * Toml Schemas
 *
 * Zod schemas for Komodo's sync-TOML export API (`komodo_toml_*` tools) —
 * export-only (the import counterpart is `komodo_resource_sync_*`, which pulls
 * TOML from a git repo). Fields mirror `Types.TomlResponse` /
 * `ExportAllResourcesToToml` / `ExportResourcesToToml`.
 *
 * @module tools/schemas/toml
 */

import { z } from "zod";
import { resourceLinkSchema } from "./shared.js";

/**
 * Split a comma-/newline-separated list into trimmed, non-empty entries.
 *
 * List inputs are taken as a single plain STRING (not an array) so MCP clients render a normal
 * text field — some render any array (even `string[]`) as a raw-JSON box that garbles on every
 * keystroke.
 */
export function splitList(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Parse a `"Type:id"` target entry into `{ type, id }`, or `null` if malformed.
 * Split on the FIRST colon — Komodo resource ids/names never contain one.
 */
export function splitResourceTarget(entry: string): { type: string; id: string } | null {
  const idx = entry.indexOf(":");
  if (idx <= 0 || idx >= entry.length - 1) return null;
  const type = entry.slice(0, idx).trim();
  const id = entry.slice(idx + 1).trim();
  return type && id ? { type, id } : null;
}

/** Output of both export tools. Large exports are offloaded to a session-scoped resource link. */
export const tomlOutputSchema = z
  .object({
    summary: z.object({
      bytes: z.number().int().describe("Size of the exported TOML in bytes"),
      secrets_masked: z
        .boolean()
        .describe(
          "Whether secret redaction was applied to this export. True (the default) means secret values — " +
            "variable values, server passkeys, alerter webhook URLs — are masked, so the TOML is for inspection " +
            "rather than re-applying verbatim. False means redaction is switched off server-side and the export " +
            "may contain plaintext secrets.",
        ),
    }),
    toml: z.string().optional().describe("The exported sync TOML (inline when small or inline_full is set)"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Exported sync TOML contents");

export const tomlExportAllInputSchema = z.object({
  include_resources: z.boolean().optional().describe("Include resources (servers, stacks, ...). Default: true"),
  tags: z
    .string()
    .optional()
    .describe(
      'Filter resources by tag — comma- or newline-separated names/ids (e.g. "prod, web"). Omitted = no tag filter.',
    ),
  include_variables: z.boolean().optional().describe("Include variables. Default: false"),
  include_user_groups: z.boolean().optional().describe("Include user groups. Default: false"),
});

export const tomlExportResourcesInputSchema = z.object({
  targets: z
    .string()
    .optional()
    .describe(
      'Resources to include — comma- or newline-separated "Type:id" entries, e.g. "Stack:web, Deployment:api, Server:prod-1". Type is the Komodo resource type (Server, Stack, Deployment, Build, Repo, Procedure, Action, Builder, Alerter, ResourceSync, ...).',
    ),
  user_groups: z
    .string()
    .optional()
    .describe('User groups to include — comma- or newline-separated names/ids (e.g. "admins, ops").'),
  include_variables: z.boolean().optional().describe("Include variables. Default: false"),
});
