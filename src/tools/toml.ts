/**
 * Toml Tools
 *
 * Export Komodo resources as sync TOML — the same format `komodo_resource_sync_*`
 * reads from a git repo (there is no import counterpart; ResourceSync applies TOML back).
 *
 * Tools (2): export_all / export_resources. Both are read operations. Output can be large,
 * so it is offloaded to a session-scoped resource link (summary + link) unless `inline_full`
 * is set.
 *
 * **Komodo Core does not redact the export; this server does.** Core masks exactly one
 * thing in it — a Variable's `value`, and only when the caller is NOT an admin
 * (`bin/core/src/api/read/toml.rs`). Every resource config passes through verbatim, so
 * alerter webhook URLs, `server.passkey` and builder secrets reach the server raw, and an
 * admin export carries Variable values too. The framework scrubs the export as a TOML
 * document wherever it appears — the offloaded resource (declared `application/toml`), the
 * inline `toml` field and the fenced block in the text — so the `maskWhenSibling` /
 * `sensitivePaths` rules in `utils/redact.ts` apply and the allowlisted `is_secret` flag
 * stays a boolean. Nothing here scrubs it a second time: a second pass is what used to
 * break escaped characters in the inline export.
 *
 * @module tools/toml
 */

import { defineTool, structured, type ToolResultFor } from "mcp-server-framework";
import type { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { ValidationError } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  tryRegisterResource,
  renderTomlExport,
  resolveScrubOptions,
} from "../utils/index.js";
import {
  tomlOutputSchema,
  tomlExportAllInputSchema,
  tomlExportResourcesInputSchema,
  splitList,
  splitResourceTarget,
  inlineFullInputSchema,
} from "./schemas/index.js";

/** MIME type of the offloaded export: the framework scrubs it as a TOML document. */
const TOML_MIME = "application/toml";

/**
 * Offload the TOML (large) to a resource unless inline_full is set; return summary + link|toml.
 *
 * Both branches are redacted alike by the framework: the offloaded one on register, by its
 * MIME type, and the inline one at the tool-result boundary, which scrubs a TOML document
 * inside a string as a document. `bytes` is the size of the export as Komodo returned it.
 */
function buildTomlResult(
  toml: string,
  name: string,
  sessionId: string | undefined,
  inlineFull: boolean | undefined,
  description: string,
): ToolResultFor<typeof tomlOutputSchema> {
  const summary = { bytes: Buffer.byteLength(toml, "utf8"), secrets_masked: resolveScrubOptions() !== false };
  const link = toml
    ? tryRegisterResource({
        ctx: { sessionId },
        category: "info",
        name,
        mimeType: TOML_MIME,
        content: toml,
        ttlMs: config.MCP_RESOURCE_TTL_INFO,
        inlineFull,
        description,
      })
    : null;

  if (link) {
    const payload = { summary, resourceLink: link };
    return structured(payload, { text: renderTomlExport(payload), links: [link] });
  }

  const payload = { summary, toml };
  return structured(payload, { text: renderTomlExport(payload) });
}

export const exportAllResourcesToTomlTool = defineTool({
  name: "komodo_toml_export_all",
  description:
    "Export every resource the caller can view as sync TOML — the same format komodo_resource_sync_* reads from a git repo. " +
    "Secret values (variable values, server passkeys, alerter webhook URLs) are redacted, so the export is for inspection " +
    "and diffing, not for re-applying verbatim via ResourceSync. " +
    "Large output is offloaded as a session-scoped resource link unless `inline_full` is set.",
  input: tomlExportAllInputSchema.extend(inlineFullInputSchema.shape),
  output: tomlOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.TOML },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const tags = args.tags ? splitList(args.tags) : undefined;
    const result = await wrapApiCall(
      "exportAllResourcesToToml",
      () =>
        komodo.client.read("ExportAllResourcesToToml", {
          include_resources: args.include_resources ?? true,
          ...(tags !== undefined && { tags }),
          ...(args.include_variables !== undefined && { include_variables: args.include_variables }),
          ...(args.include_user_groups !== undefined && { include_user_groups: args.include_user_groups }),
        }),
      abortSignal,
    );
    return buildTomlResult(
      result.toml,
      "all-resources.toml",
      sessionId,
      args.inline_full,
      "Full resource export as sync TOML",
    );
  },
});

export const exportResourcesToTomlTool = defineTool({
  name: "komodo_toml_export_resources",
  description:
    "Export a specific set of resources and/or user groups as sync TOML. " +
    "Secret values are redacted, so the export is for inspection and diffing, not for re-applying verbatim via ResourceSync.",
  input: tomlExportResourcesInputSchema.extend(inlineFullInputSchema.shape),
  output: tomlOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.TOML },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const targetEntries = args.targets ? splitList(args.targets) : [];
    const targets = targetEntries.length
      ? targetEntries.map((entry) => {
          const target = splitResourceTarget(entry);
          if (!target) {
            throw new ValidationError(`Invalid target "${entry}". Use "Type:id", e.g. "Stack:web".`, {
              field: "targets",
            });
          }
          // @type-variance — { type: string } → SDK `ResourceTarget` (a per-type discriminated union).
          // Komodo validates the resource type server-side.
          return target as Types.ResourceTarget;
        })
      : undefined;
    const userGroups = args.user_groups ? splitList(args.user_groups) : undefined;
    const result = await wrapApiCall(
      "exportResourcesToToml",
      () =>
        komodo.client.read("ExportResourcesToToml", {
          ...(targets !== undefined && { targets }),
          ...(userGroups !== undefined && userGroups.length > 0 && { user_groups: userGroups }),
          ...(args.include_variables !== undefined && { include_variables: args.include_variables }),
        }),
      abortSignal,
    );
    return buildTomlResult(
      result.toml,
      "resources.toml",
      sessionId,
      args.inline_full,
      "Selected resources exported as sync TOML",
    );
  },
});
