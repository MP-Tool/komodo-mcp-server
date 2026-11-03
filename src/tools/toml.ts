/**
 * Toml Tools
 *
 * Export Komodo resources as sync TOML — the same format `komodo_resource_sync_*`
 * reads from a git repo (there is no import counterpart; ResourceSync applies TOML back).
 *
 * Tools (2): export_all / export_resources. Both are read operations, delivered
 * according to the configured link/inline/auto policy and inline_full override.
 *
 * **Redaction is this tool's own responsibility, not Komodo Core's.** Core masks exactly
 * one thing in the export — a Variable's `value`, and only when the caller is NOT an admin
 * (`bin/core/src/api/read/toml.rs`). Every resource config passes through verbatim, so
 * alerter webhook URLs, `server.passkey` and builder secrets reach the client raw, and an
 * admin export leaks Variable values too. With redaction enabled, every export must
 * pass a strict parse → policy scrub → serialize → validate step BEFORE delivery.
 * The framework's MIME scrub falls back to flat text on parse/serialization failure,
 * which cannot enforce structural rules. Only pre-scrubbed valid TOML reaches that
 * defense-in-depth boundary; failures here withhold the export without logging it.
 *
 * @module tools/toml
 */

import { defineTool, structured, error } from "mcp-server-framework";
import { createSecretScrubber } from "mcp-server-framework/logger";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { Types } from "komodo_client";
import { RESOURCE_DELIVERY_DESCRIPTION, ToolCategories, ToolScopes, config } from "../config/index.js";
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
 * Prepare one validated, structurally scrubbed export for BOTH delivery paths.
 * Never forward parser errors or their causes: they may contain raw TOML/secrets.
 * An explicit redaction opt-out retains the existing unmodified export behavior.
 */
function buildTomlResult(
  toml: unknown,
  name: string,
  sessionId: string | undefined,
  inlineFull: boolean | undefined,
  description: string,
): ReturnType<typeof structured> {
  if (typeof toml !== "string") return error("TOML export withheld: invalid export payload.");
  const scrubConfig = resolveScrubOptions();
  let content = toml;
  if (scrubConfig !== false) {
    try {
      const scrubber = createSecretScrubber(scrubConfig);
      if (!scrubber) throw new Error("Missing export scrubber");
      content = stringifyToml(scrubber.scrubObject(parseToml(toml)));
      parseToml(content); // Validate the actual serialized export, not just its MIME type.
    } catch {
      return error("TOML export withheld: structural secret redaction failed.");
    }
  }
  const originalBytes = Buffer.byteLength(toml, "utf8");
  const summary = { bytes: Buffer.byteLength(content, "utf8"), secrets_masked: scrubConfig !== false };
  const link = content
    ? tryRegisterResource({
        ctx: { sessionId },
        category: "info",
        name,
        mimeType: TOML_MIME,
        content,
        originalBytes,
        ttlMs: config.MCP_RESOURCE_TTL_INFO,
        inlineFull,
        description,
      })
    : null;

  if (link) {
    const payload = { summary, resourceLink: link };
    return structured(payload, { text: renderTomlExport(payload), links: [link] });
  }

  const payload = { summary, toml: content };
  return structured(payload, { text: renderTomlExport(payload) });
}

export const exportAllResourcesToTomlTool = defineTool({
  name: "komodo_toml_export_all",
  description:
    "Export every resource the caller can view as sync TOML — the same format komodo_resource_sync_* reads from a git repo. " +
    "When secret scrubbing is enabled, secret values (variable values, server passkeys, alerter webhook URLs) are redacted, " +
    "so the export is for inspection and diffing, not for re-applying verbatim via ResourceSync. " +
    "When scrubbing is explicitly disabled, the export may contain unmasked credentials. " +
    RESOURCE_DELIVERY_DESCRIPTION,
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
    "When secret scrubbing is enabled, secret values are redacted, so the export is for inspection and diffing, " +
    "not for re-applying verbatim via ResourceSync. " +
    "When scrubbing is explicitly disabled, the export may contain unmasked credentials. " +
    RESOURCE_DELIVERY_DESCRIPTION,
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
