/**
 * Container Tools
 *
 * Tools for listing, inspecting, and controlling Docker container lifecycle
 * on Komodo-managed servers.
 *
 * Tools (5):
 * - `komodo_container_list`        — list containers on a server
 * - `komodo_container_inspect`     — Docker inspect data
 * - `komodo_container_logs`        — stdout/stderr logs
 * - `komodo_container_search_logs` — keyword search across logs
 * - `komodo_container_action`      — consolidated lifecycle (start/stop/restart/pause/unpause)
 *
 * @module tools/container
 */

import { defineTool, structured, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import {
  PARAM_DESCRIPTIONS,
  CONTAINER_LOGS_DEFAULTS,
  LOG_DESCRIPTIONS,
  LOG_SEARCH_DEFAULTS,
  ToolCategories,
  ToolScopes,
  config,
} from "../config/index.js";
import {
  requireClient,
  requireKomodoPermission,
  wrapApiCall,
  wrapExecuteAndPoll,
  buildActionResult,
  extractUpdateId,
  paginate,
  renderContainerList,
  renderContainerInspect,
  renderContainerLogs,
  renderContainerSearchLogs,
  renderActionResult,
  tryRegisterResource,
} from "../utils/index.js";
import {
  containerActionInputSchema,
  serverIdSchema,
  containerNameSchema,
  containerListOutputSchema,
  containerInspectOutputSchema,
  containerLogsOutputSchema,
  containerSearchLogsOutputSchema,
  actionResultSchema,
  inlineFullInputSchema,
  paginationInputSchema,
} from "./schemas/index.js";

type ContainerListItem = Types.ContainerListItem;
type Log = Types.Log;

// ============================================================================
// Backward-compatible container read names
// ============================================================================

// Komodo Core v2.3 renamed the container read APIs (dropping the "Docker" prefix):
// `ListDockerContainers` → `ListContainers`, `InspectDockerContainer` → `InspectContainer`.
// Core ≥ 2.3 keeps the old names as serde aliases; Core ≤ 2.2 only knows the old names. We
// send the legacy names so container tools work on every Komodo v2 core (2.0–2.3+), typed via
// the current names because the 2.3.x client dropped the old aliases from its generated types.
const LIST_CONTAINERS_READ = "ListDockerContainers" as unknown as "ListContainers";
const INSPECT_CONTAINER_READ = "InspectDockerContainer" as unknown as "InspectContainer";

// ============================================================================
// List
// ============================================================================

export const listContainersTool = defineTool({
  name: "komodo_container_list",
  description:
    "List all containers on a server, including running, stopped, and paused containers. Shows container name, state, and image.",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_TO_LIST_CONTAINERS),
    })
    .merge(paginationInputSchema),
  output: containerListOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, Types.PermissionLevel.Read);
    const containers = await wrapApiCall(
      "listContainers",
      // Per-server container list — unpaginated in Core (no server-side page limit to bypass).
      () => komodo.client.read(LIST_CONTAINERS_READ, { server: args.server }),
      abortSignal,
    );

    const allItems = containers.map((c: ContainerListItem) => ({
      name: c.name,
      state: c.state,
      ...(c.image ? { image: c.image } : {}),
    }));

    const { items, page } = paginate(allItems, args.cursor, args.page_size);
    const payload = { items: [...items], page };
    return structured(payload, { text: renderContainerList(payload) });
  },
});

// ============================================================================
// Inspect
// ============================================================================

export const inspectContainerTool = defineTool({
  name: "komodo_container_inspect",
  description:
    "Get detailed low-level information about a container. Returns Docker inspect data including configuration, state, network settings, mounts, and process info.",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
      container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_INSPECT),
    })
    .merge(inlineFullInputSchema),
  output: containerInspectOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, Types.PermissionLevel.Read);
    // Config.Env is the resolved runtime environment, so a secret stored as a
    // Komodo Variable surfaces here as plaintext — covered centrally: the
    // framework scrubs the tool result at the boundary and the offloaded
    // resource on register (KEY=value entries in the Env array included).
    const result = await wrapApiCall(
      "inspectContainer",
      () => komodo.client.read(INSPECT_CONTAINER_READ, { server: args.server, container: args.container }),
      abortSignal,
    );
    // Key facts as the default minimum — the full inspect payload stays in the resource.
    const summary = {
      name: args.container,
      ...(result.State?.Status && { state: result.State.Status }),
      ...(result.Config?.Image && { image: result.Config.Image }),
    };
    const link = tryRegisterResource({
      ctx: { sessionId },
      category: "inspect",
      name: `${args.container} (inspect)`,
      mimeType: "application/json",
      content: JSON.stringify(result, null, 2),
      ttlMs: config.MCP_RESOURCE_TTL_INFO,
      inlineFull: args.inline_full,
      description: `Docker inspect data for container ${args.container} on ${args.server}`,
    });
    const payload = link ? { summary, resourceLink: link } : { summary, inspect: result };
    return structured(payload, {
      text: renderContainerInspect(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Logs
// ============================================================================

export const getContainerLogsTool = defineTool({
  name: "komodo_container_logs",
  description:
    "Get stdout and stderr logs from a container. Useful for debugging, monitoring application output, and troubleshooting issues.",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
      container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_LOGS),
      tail: z
        .number()
        .int()
        .positive()
        .optional()
        .default(CONTAINER_LOGS_DEFAULTS.TAIL)
        .describe(LOG_DESCRIPTIONS.TAIL_LINES(CONTAINER_LOGS_DEFAULTS.TAIL)),
      timestamps: z
        .boolean()
        .optional()
        .default(CONTAINER_LOGS_DEFAULTS.TIMESTAMPS)
        .describe(LOG_DESCRIPTIONS.TIMESTAMPS(CONTAINER_LOGS_DEFAULTS.TIMESTAMPS)),
    })
    .merge(inlineFullInputSchema),
  output: containerLogsOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, Types.PermissionLevel.Read);

    const result: Log = await wrapApiCall(
      "getContainerLogs",
      () =>
        komodo.client.read("GetContainerLog", {
          server: args.server,
          container: args.container,
          tail: args.tail,
          timestamps: args.timestamps,
        }),
      abortSignal,
    );

    const stdout = result.stdout;
    const stderr = result.stderr;
    const fullLogs =
      stdout || stderr
        ? [stdout && `=== stdout ===\n${stdout}`, stderr && `=== stderr ===\n${stderr}`].filter(Boolean).join("\n\n")
        : "";
    const link = fullLogs
      ? tryRegisterResource({
          ctx: { sessionId },
          category: "logs",
          name: `${args.container} (logs)`,
          mimeType: "text/plain",
          content: fullLogs,
          ttlMs: config.MCP_RESOURCE_TTL_LOGS,
          inlineFull: args.inline_full,
          description: `Container logs for ${args.container} on ${args.server}`,
        })
      : null;

    const payload = link
      ? { summary: { name: args.container }, resourceLink: link }
      : {
          summary: { name: args.container },
          ...(stdout ? { stdout } : {}),
          ...(stderr ? { stderr } : {}),
        };
    return structured(payload, {
      text: renderContainerLogs(payload),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Search Logs
// ============================================================================

export const searchContainerLogsTool = defineTool({
  name: "komodo_container_search_logs",
  description:
    "Search container logs for specific patterns or keywords. Retrieves logs and filters them client-side. Returns matching lines with a count of matches. Large match sets are offloaded as a session-scoped resource link unless `inline_full` is set.",
  input: z
    .object({
      server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
      container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_SEARCH),
      query: z.string().describe(LOG_DESCRIPTIONS.SEARCH_QUERY),
      tail: z
        .number()
        .int()
        .positive()
        .optional()
        .default(LOG_SEARCH_DEFAULTS.TAIL)
        .describe(LOG_DESCRIPTIONS.TAIL_LINES_FOR_SEARCH(LOG_SEARCH_DEFAULTS.TAIL)),
      caseSensitive: z
        .boolean()
        .optional()
        .default(LOG_SEARCH_DEFAULTS.CASE_SENSITIVE)
        .describe(LOG_DESCRIPTIONS.CASE_SENSITIVE(LOG_SEARCH_DEFAULTS.CASE_SENSITIVE)),
    })
    .merge(inlineFullInputSchema),
  output: containerSearchLogsOutputSchema,
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, Types.PermissionLevel.Read);

    const result: Log = await wrapApiCall(
      "searchContainerLogs",
      () =>
        komodo.client.read("GetContainerLog", {
          server: args.server,
          container: args.container,
          tail: args.tail,
          timestamps: false,
        }),
      abortSignal,
    );

    const stdoutLines = result.stdout
      ? result.stdout.split("\n").map((line) => ({ stream: "stdout" as const, line }))
      : [];
    const stderrLines = result.stderr
      ? result.stderr.split("\n").map((line) => ({ stream: "stderr" as const, line }))
      : [];
    const allLines = [...stdoutLines, ...stderrLines];
    const query = args.caseSensitive ? args.query : args.query.toLowerCase();
    const matches = allLines.filter(({ line }) => {
      const haystack = args.caseSensitive ? line : line.toLowerCase();
      return haystack.includes(query);
    });

    const link =
      matches.length > 0
        ? tryRegisterResource({
            ctx: { sessionId },
            category: "logs",
            name: `${args.container} (search: ${args.query})`,
            mimeType: "text/plain",
            content: matches.map((m) => `[${m.stream}] ${m.line}`).join("\n"),
            ttlMs: config.MCP_RESOURCE_TTL_LOGS,
            inlineFull: args.inline_full,
            description: `${matches.length} matching log line(s) for query "${args.query}" in ${args.container}`,
          })
        : null;

    const summary = { name: args.container, matched: matches.length };
    const payload = link ? { summary, matches: [], resourceLink: link } : { summary, matches };
    return structured(payload, {
      text: renderContainerSearchLogs({
        summary: payload.summary,
        matches,
        ...(link ? { resourceLink: link } : {}),
      }),
      ...(link ? { links: [link] } : {}),
    });
  },
});

// ============================================================================
// Lifecycle
// ============================================================================

/** Maps the action enum to the corresponding Komodo execute API name. */
const CONTAINER_ACTION_API_MAP = {
  start: "StartContainer",
  stop: "StopContainer",
  restart: "RestartContainer",
  pause: "PauseContainer",
  unpause: "UnpauseContainer",
} as const satisfies Record<
  z.infer<typeof containerActionInputSchema>["action"],
  "StartContainer" | "StopContainer" | "RestartContainer" | "PauseContainer" | "UnpauseContainer"
>;

export const containerActionTool = defineTool({
  name: "komodo_container_action",
  description:
    "Run a lifecycle action on a Docker container: start, stop, restart, pause, or unpause. " +
    "The container must exist on the target server. " +
    "Note: pause/unpause use cgroups freezer; restart is stop+start.",
  input: containerActionInputSchema,
  output: actionResultSchema,
  annotations: { readOnlyHint: false, idempotentHint: false },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    await requireKomodoPermission({ type: "Server", id: args.server }, Types.PermissionLevel.Execute);
    const apiAction = CONTAINER_ACTION_API_MAP[args.action];
    const update = await wrapExecuteAndPoll(
      `${args.action}Container`,
      () => komodo.client.execute(apiAction, { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    const payload = buildActionResult(update, args.action, "container", args.container, args.server);
    return structured(payload, {
      text: renderActionResult(payload, { updateId: extractUpdateId(update), logs: update.logs }),
    });
  },
});
