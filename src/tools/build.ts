/**
 * Build Tools
 *
 * Tools for managing Komodo Build resources.
 *
 * Tools (6):
 * - `komodo_build_list`   — list registered builds
 * - `komodo_build_info`   — full build resource (config + status)
 * - `komodo_build_action` — lifecycle: run (long-running, polled) | cancel (fire-and-forget)
 * - `komodo_build_logs`   — fetch logs from a previous build run via update id
 * - `komodo_build_apply`  — create-or-update (discriminated by `action`)
 * - `komodo_build_delete` — unregister a build
 *
 * @module tools/build
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes, config } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import {
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  paginate,
  renderBuildList,
  renderBuildInfo,
  renderBuildLogs,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  buildIdSchema,
  buildListOutputSchema,
  buildInfoOutputSchema,
  buildActionOutputSchema,
  buildActionInputSchema,
  buildApplyInputSchema,
  buildLogsOutputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type BuildListItem = Types.BuildListItem;
type Update = Types.Update;

function formatVersion(v?: { major: number; minor: number; patch: number }): string | undefined {
  if (!v) return undefined;
  if (v.major === 0 && v.minor === 0 && v.patch === 0) return undefined;
  return `${v.major}.${v.minor}.${v.patch}`;
}

// ============================================================================
// List
// ============================================================================

export const listBuildsTool = defineTool({
  name: "komodo_build_list",
  description:
    "List all builds registered in Komodo. Shows build id, name, current state (Building/Ok/Failed/Unknown), version, attached builder, source repo and branch.",
  input: paginationInputSchema,
  output: buildListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.BUILD },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const builds = await wrapApiCall("listBuilds", () => komodo.client.read("ListBuilds", {}), abortSignal);

    const allItems = builds.map((b: BuildListItem) => {
      const version = formatVersion(b.info.version);
      return {
        id: b.id,
        name: b.name,
        state: b.info.state,
        ...(version ? { version } : {}),
        ...(b.info.builder_id ? { builder_id: b.info.builder_id } : {}),
        ...(b.info.repo ? { repo: b.info.repo } : {}),
        ...(b.info.branch ? { branch: b.info.branch } : {}),
        ...(b.info.last_built_at ? { last_built_at: b.info.last_built_at } : {}),
      };
    });

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderBuildList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getBuildInfoTool = defineTool({
  name: "komodo_build_info",
  description:
    "Get the full Komodo Build resource for a single build, including its configuration (builder, repo/branch, image, dockerfile, build args, labels) and last-built metadata.",
  input: z
    .object({
      build: buildIdSchema.describe("Build id or name"),
    })
    .merge(inlineFullInputSchema),
  output: buildInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.BUILD },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "getBuild",
      () => komodo.client.read("GetBuild", { build: args.build }),
      abortSignal,
    );
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (build info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full build resource for ${result.name}`,
    });
    const summary = {
      id: result._id?.$oid ?? args.build,
      name: result.name,
      ...(formatVersion(result.config?.version) ? { version: formatVersion(result.config?.version) } : {}),
      ...(result.config?.builder_id ? { builder_id: result.config.builder_id } : {}),
      ...(result.config?.repo ? { repo: result.config.repo } : {}),
      ...(result.config?.branch ? { branch: result.config.branch } : {}),
      ...(result.info?.last_built_at ? { last_built_at: result.info.last_built_at } : {}),
    };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderBuildInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Action (run / cancel)
// ============================================================================

/** Maps the action enum to the corresponding Komodo execute API name. */
const BUILD_ACTION_API_MAP = {
  run: "RunBuild",
  cancel: "CancelBuild",
} as const satisfies Record<z.infer<typeof buildActionInputSchema>["action"], "RunBuild" | "CancelBuild">;

export const buildActionTool = defineTool({
  name: "komodo_build_action",
  description:
    "Run a lifecycle action on a Komodo Build. action=run: trigger build (long-running; polled to completion). action=cancel: abort in-progress build (fire-and-forget). Returns the resulting Update.",
  input: buildActionInputSchema,
  output: buildActionOutputSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.BUILD },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = BUILD_ACTION_API_MAP[args.action];
    if (args.action === "run") {
      const update = await wrapExecuteAndPoll(
        `run build '${args.build}'`,
        () => komodo.client.execute(apiAction as "RunBuild", { build: args.build }),
        abortSignal,
        reportProgress,
      );
      const payload = buildActionResult(update, "run", "build", args.build);
      return structured(payload, {
        text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
      });
    }
    const update: Update = await wrapApiCall(
      `cancel build '${args.build}'`,
      // @sdk-constraint — SDK execute() type uses literal-keyed unions; runtime accepts mapped string
      () => komodo.client.execute(apiAction as "CancelBuild", { build: args.build }),
      abortSignal,
    );
    const payload = buildActionResult(update, "cancel", "build", args.build);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});

// ============================================================================
// Logs
// ============================================================================

export const getBuildLogsTool = defineTool({
  name: "komodo_build_logs",
  description:
    "Fetch per-stage logs from a previous build run. Pass the `update_id` returned by `komodo_build_action`.",
  input: z
    .object({
      update_id: z.string().min(1).describe("Komodo Update id returned by a previous komodo_build_run call"),
    })
    .merge(inlineFullInputSchema),
  output: buildLogsOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.BUILD },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const update: Update = await wrapApiCall(
      "getBuildUpdate",
      () => komodo.client.read("GetUpdate", { id: args.update_id }),
      abortSignal,
    );

    const buildName = update.target.id || args.update_id;

    const fullLogs =
      update.logs.length > 0
        ? update.logs
            .map((l) => {
              const head = `=== ${l.stage} ${l.success ? "✅" : "❌"} ===`;
              const cmd = l.command ? `$ ${l.command}` : "";
              const out = l.stdout ? `[stdout]\n${l.stdout}` : "";
              const err = l.stderr ? `[stderr]\n${l.stderr}` : "";
              return [head, cmd, out, err].filter(Boolean).join("\n");
            })
            .join("\n\n")
        : "";

    const link = fullLogs
      ? tryRegisterResource({
          ctx: { sessionId },
          category: "logs",
          name: `${buildName} (build logs)`,
          mimeType: "text/plain",
          content: fullLogs,
          ttlMs: config.KOMODO_RESOURCE_TTL_LOGS,
          inlineFull: args.inline_full,
          description: `Build logs for update ${args.update_id}`,
        })
      : null;

    const summary = {
      id: args.update_id,
      name: buildName,
    };
    const payload = link
      ? {
          summary,
          update_id: args.update_id,
          success: update.success,
          status: update.status,
          resourceLink: link,
        }
      : {
          summary,
          update_id: args.update_id,
          success: update.success,
          status: update.status,
          logs: update.logs.map((l) => ({
            stage: l.stage,
            command: l.command,
            success: l.success,
            stdout: l.stdout,
            stderr: l.stderr,
            start_ts: l.start_ts,
            end_ts: l.end_ts,
          })),
        };

    return structured(payload, {
      text: renderBuildLogs(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Apply / Delete
// ============================================================================

export const applyBuildTool = defineTool({
  name: "komodo_build_apply",
  description: [
    "Create or update a Komodo Build (PATCH-style). Does not trigger a build — call `komodo_build_action` run afterwards.",
    'action="create": new build. Required: name. Provide repo/branch/builder in config.',
    'action="update": existing build (`build` required). Only fields in `config` change.',
  ].join("\n"),
  input: buildApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.BUILD },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const result = await wrapApiCall(
        "createBuild",
        // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<BuildConfig>` (`T`).
        () =>
          komodo.client.write("CreateBuild", {
            name,
            config: (args.config ?? {}) as Types._PartialBuildConfig,
          }),
        abortSignal,
      );
      const built = buildApplyResult("create", "build", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.build) throw AppErrorFactory.validation.fieldRequired("build");
    const buildId = args.build;
    const result = await wrapApiCall(
      "updateBuild",
      // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<BuildConfig>` (`T`).
      () =>
        komodo.client.write("UpdateBuild", {
          id: buildId,
          config: args.config as Types._PartialBuildConfig,
        }),
      abortSignal,
    );
    const built = buildApplyResult("update", "build", buildId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteBuildTool = defineTool({
  name: "komodo_build_delete",
  description: "Unregister a Build from Komodo. Does not delete previously pushed images from the registry.",
  input: z.object({
    build: buildIdSchema.describe("Build id or name to delete"),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.BUILD },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteBuild",
      () => komodo.client.write("DeleteBuild", { id: args.build }),
      abortSignal,
    );
    const built = buildDeleteResult("build", args.build, result);
    return structured(built.payload, { text: built.text });
  },
});
