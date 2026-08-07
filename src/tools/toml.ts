/**
 * Toml Tools
 *
 * Export Komodo resources as sync TOML — the same format `komodo_resource_sync_*`
 * reads from a git repo (there is no import counterpart; ResourceSync applies TOML back).
 *
 * Tools (2): export_all / export_resources. Both are read operations. Output can be large,
 * so it is offloaded to a session-scoped resource link (summary + link) unless `inline_full`
 * is set. Komodo renders secret values as `[[VAR]]` placeholders; the framework scrub boundary
 * is the backstop.
 *
 * @module tools/toml
 */

import { defineTool, structured } from "mcp-server-framework";
import type { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import { requireClient, wrapApiCall, tryRegisterResource, renderTomlExport } from "../utils/index.js";
import {
  tomlOutputSchema,
  tomlExportAllInputSchema,
  tomlExportResourcesInputSchema,
  splitList,
  splitResourceTarget,
  inlineFullInputSchema,
} from "./schemas/index.js";

/** Offload the TOML (large) to a resource unless inline_full is set; return summary + link|toml. */
function buildTomlResult(
  toml: string,
  name: string,
  sessionId: string | undefined,
  inlineFull: boolean | undefined,
  description: string,
): ReturnType<typeof structured> {
  const summary = { bytes: Buffer.byteLength(toml, "utf8"), secrets_masked: true };
  const link = toml
    ? tryRegisterResource({
        ctx: { sessionId },
        category: "info",
        name,
        mimeType: "text/plain",
        content: toml,
        ttlMs: config.MCP_RESOURCE_TTL_INFO,
        inlineFull,
        description,
      })
    : null;
  const payload = link ? { summary, resourceLink: link } : { summary, toml };
  return structured(payload, { text: renderTomlExport(payload), ...(link ? { links: [link] } : {}) });
}

export const exportAllResourcesToTomlTool = defineTool({
  name: "komodo_toml_export_all",
  description:
    "Export every resource the caller can view as sync TOML — the same format komodo_resource_sync_* reads from a git repo. Large output is offloaded as a session-scoped resource link unless `inline_full` is set.",
  input: tomlExportAllInputSchema.merge(inlineFullInputSchema),
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
  description: "Export a specific set of resources and/or user groups as sync TOML.",
  input: tomlExportResourcesInputSchema.merge(inlineFullInputSchema),
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
            throw AppErrorFactory.validation.custom(
              `Invalid target "${entry}". Use "Type:id", e.g. "Stack:web".`,
              "targets",
            );
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
