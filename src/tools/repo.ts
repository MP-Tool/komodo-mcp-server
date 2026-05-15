/**
 * Repo Tools
 *
 * Tools for managing Komodo Repo resources.
 *
 * Tools (5):
 * - `komodo_repo_list`    — list registered repos
 * - `komodo_repo_info`    — full repo resource
 * - `komodo_repo_action`  — lifecycle: clone | pull | build | cancel_build
 * - `komodo_repo_apply`   — create-or-update (discriminated by `action`)
 * - `komodo_repo_delete`  — unregister a repo
 *
 * @module tools/repo
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
  renderRepoList,
  renderRepoInfo,
  renderActionResult,
  tryRegisterResource,
  buildApplyResult,
  buildDeleteResult,
} from "../utils/index.js";
import {
  repoIdSchema,
  repoListOutputSchema,
  repoInfoOutputSchema,
  repoActionOutputSchema,
  repoActionInputSchema,
  repoApplyInputSchema,
  applyResultSchema,
  deleteResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type RepoListItem = Types.RepoListItem;

// ============================================================================
// List
// ============================================================================

export const listReposTool = defineTool({
  name: "komodo_repo_list",
  description:
    "List all repos registered in Komodo. Shows id, name, state, attached server/builder, configured repo+branch, and the cloned/built/latest short commit hashes.",
  input: paginationInputSchema,
  output: repoListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.REPO },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const repos = await wrapApiCall("listRepos", () => komodo.client.read("ListRepos", {}), abortSignal);

    const allItems = repos.map((r: RepoListItem) => ({
      id: r.id,
      name: r.name,
      state: r.info.state,
      ...(r.info.server_id ? { server_id: r.info.server_id } : {}),
      ...(r.info.builder_id ? { builder_id: r.info.builder_id } : {}),
      ...(r.info.repo ? { repo: r.info.repo } : {}),
      ...(r.info.branch ? { branch: r.info.branch } : {}),
      ...(r.info.cloned_hash ? { cloned_hash: r.info.cloned_hash } : {}),
      ...(r.info.built_hash ? { built_hash: r.info.built_hash } : {}),
      ...(r.info.latest_hash ? { latest_hash: r.info.latest_hash } : {}),
      ...(r.info.last_pulled_at ? { last_pulled_at: r.info.last_pulled_at } : {}),
      ...(r.info.last_built_at ? { last_built_at: r.info.last_built_at } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderRepoList(payload) });
  },
});

// ============================================================================
// Info
// ============================================================================

export const getRepoInfoTool = defineTool({
  name: "komodo_repo_info",
  description: "Get the full Komodo Repo resource (configuration + last clone/build metadata).",
  input: z
    .object({
      repo: repoIdSchema.describe("Repo id or name"),
    })
    .merge(inlineFullInputSchema),
  output: repoInfoOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.REPO },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const result = await wrapApiCall("getRepo", () => komodo.client.read("GetRepo", { repo: args.repo }), abortSignal);
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "info",
      name: `${result.name} (repo info)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.KOMODO_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Full repo resource for ${result.name}`,
    });
    const summary = {
      id: result._id?.$oid ?? args.repo,
      name: result.name,
      ...(result.config?.server_id ? { server_id: result.config.server_id } : {}),
      ...(result.config?.builder_id ? { builder_id: result.config.builder_id } : {}),
      ...(result.config?.repo ? { repo: result.config.repo } : {}),
      ...(result.config?.branch ? { branch: result.config.branch } : {}),
    };
    const payload = link ? { summary, resourceLink: link } : { summary, info: result };
    return structured(payload, {
      text: renderRepoInfo(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Lifecycle (consolidated action)
// ============================================================================

/** Maps the action enum to the corresponding Komodo execute API name. */
const REPO_ACTION_API_MAP = {
  clone: "CloneRepo",
  pull: "PullRepo",
  build: "BuildRepo",
  cancel_build: "CancelRepoBuild",
} as const satisfies Record<"clone" | "pull" | "build" | "cancel_build", string>;

export const repoActionTool = defineTool({
  name: "komodo_repo_action",
  description:
    "Lifecycle action on a Komodo Repo. clone/pull/build are long-running and polled to completion. cancel_build is fire-and-forget.",
  input: repoActionInputSchema,
  output: repoActionOutputSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.REPO },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = REPO_ACTION_API_MAP[args.action];
    const update = await wrapExecuteAndPoll(
      `${args.action} repo '${args.repo}'`,
      // @sdk-constraint — SDK execute() type uses literal-keyed unions; runtime accepts mapped string
      () => komodo.client.execute(apiAction as "CloneRepo", { repo: args.repo }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "repo", args.repo);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});

// ============================================================================
// CRUD
// ============================================================================

export const applyRepoTool = defineTool({
  name: "komodo_repo_apply",
  description: [
    "Create or update a Komodo Repo (PATCH-style). Not cloned automatically — call `komodo_repo_action` clone afterwards.",
    'action="create": new repo. Required: name.',
    'action="update": existing repo (`repo` required). Only fields in `config` change.',
  ].join("\n"),
  input: repoApplyInputSchema,
  output: applyResultSchema,
  annotations: { idempotentHint: false },
  _meta: { category: ToolCategories.REPO },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    if (args.action === "create") {
      if (!args.name) throw AppErrorFactory.validation.fieldRequired("name");
      const name = args.name;
      const repoConfig: Record<string, unknown> = { ...args.config };
      const result = await wrapApiCall(
        "createRepo",
        () => komodo.client.write("CreateRepo", { name, config: repoConfig }),
        abortSignal,
      );
      const built = buildApplyResult("create", "repo", name, result);
      return structured(built.payload, { text: built.text });
    }
    if (!args.repo) throw AppErrorFactory.validation.fieldRequired("repo");
    const repoId = args.repo;
    const result = await wrapApiCall(
      "updateRepo",
      // @type-variance — Zod-inferred optional fields (`T | undefined`) → SDK `Partial<RepoConfig>` (`T`).
      () => komodo.client.write("UpdateRepo", { id: repoId, config: args.config as Types._PartialRepoConfig }),
      abortSignal,
    );
    const built = buildApplyResult("update", "repo", repoId, result);
    return structured(built.payload, { text: built.text });
  },
});

export const deleteRepoTool = defineTool({
  name: "komodo_repo_delete",
  description: "Unregister a Repo from Komodo. Does not affect the cloned working copy on the server.",
  input: z.object({
    repo: repoIdSchema.describe("Repo id or name to delete"),
  }),
  output: deleteResultSchema,
  annotations: { destructiveHint: true },
  _meta: { category: ToolCategories.REPO },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "deleteRepo",
      () => komodo.client.write("DeleteRepo", { id: args.repo }),
      abortSignal,
    );
    const built = buildDeleteResult("repo", args.repo, result);
    return structured(built.payload, { text: built.text });
  },
});
