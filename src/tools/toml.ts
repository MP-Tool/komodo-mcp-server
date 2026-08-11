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
 * **Redaction is this tool's own responsibility, not Komodo Core's.** Core masks exactly
 * one thing in the export — a Variable's `value`, and only when the caller is NOT an admin
 * (`bin/core/src/api/read/toml.rs`). Every resource config passes through verbatim, so
 * alerter webhook URLs, `server.passkey` and builder secrets reach the client raw, and an
 * admin export leaks Variable values too. The content is therefore declared as
 * `application/toml` so the framework scrubs it STRUCTURALLY (parse → scrubObject →
 * re-serialize): only that path applies the `maskWhenSibling` / `sensitivePaths` rules in
 * `utils/redact.ts`, and only it leaves the allowlisted `is_secret` boolean intact — the
 * flat-text pass masks the flag itself and breaks the document.
 *
 * @module tools/toml
 */

import { defineTool, structured } from "mcp-server-framework";
import { createSecretScrubber, scrubByMimeType } from "mcp-server-framework/logger";
import type { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
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

/** MIME type that routes content through the framework's STRUCTURAL scrub (never `text/plain`). */
const TOML_MIME = "application/toml";

/**
 * Offload the TOML (large) to a resource unless inline_full is set; return summary + link|toml.
 *
 * Both branches must end up equally redacted. The offloaded branch is scrubbed by the
 * registry on register; the inline branch would otherwise reach `structuredContent` as a
 * raw string and get only the tool-result boundary's flat-text pass — which misses every
 * structural rule. So the inline branch is scrubbed here, with the same policy and the
 * same MIME type, before it is handed over.
 */
function buildTomlResult(
  toml: string,
  name: string,
  sessionId: string | undefined,
  inlineFull: boolean | undefined,
  description: string,
): ReturnType<typeof structured> {
  const scrubConfig = resolveScrubOptions();
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
    const summary = { bytes: Buffer.byteLength(toml, "utf8"), secrets_masked: scrubConfig !== false };
    const payload = { summary, resourceLink: link };
    return structured(payload, { text: renderTomlExport(payload), links: [link] });
  }

  const scrubber = createSecretScrubber(scrubConfig);
  const inline = scrubber ? scrubByMimeType(toml, TOML_MIME, scrubber) : toml;
  const summary = { bytes: Buffer.byteLength(inline, "utf8"), secrets_masked: scrubber !== undefined };
  const payload = { summary, toml: inline };
  return structured(payload, { text: renderTomlExport(payload) });
}

export const exportAllResourcesToTomlTool = defineTool({
  name: "komodo_toml_export_all",
  description:
    "Export every resource the caller can view as sync TOML — the same format komodo_resource_sync_* reads from a git repo. " +
    "Secret values (variable values, server passkeys, alerter webhook URLs) are redacted, so the export is for inspection " +
    "and diffing, not for re-applying verbatim via ResourceSync. " +
    "Large output is offloaded as a session-scoped resource link unless `inline_full` is set.",
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
  description:
    "Export a specific set of resources and/or user groups as sync TOML. " +
    "Secret values are redacted, so the export is for inspection and diffing, not for re-applying verbatim via ResourceSync.",
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
