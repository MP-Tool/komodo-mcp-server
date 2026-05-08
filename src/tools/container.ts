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

import { defineTool, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import {
  PARAM_DESCRIPTIONS,
  CONTAINER_LOGS_DEFAULTS,
  LOG_DESCRIPTIONS,
  LOG_SEARCH_DEFAULTS,
  ToolCategories,
  ToolScopes,
} from "../config/index.js";
import {
  formatLogsResponse,
  formatSearchResponse,
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  formatUpdateResult,
} from "../utils/index.js";
import { containerActionInputSchema, serverIdSchema, containerNameSchema } from "./schemas/index.js";

type ContainerListItem = Types.ContainerListItem;
type Log = Types.Log;

// ============================================================================
// List
// ============================================================================

export const listContainersTool = defineTool({
  name: "komodo_container_list",
  description:
    "List all containers on a server, including running, stopped, and paused containers. Shows container name, state, and image.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_TO_LIST_CONTAINERS),
  }),
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const containers = await wrapApiCall(
      "listContainers",
      () => komodo.client.read("ListDockerContainers", { server: args.server }),
      abortSignal,
    );

    const containerList =
      containers.map((c: ContainerListItem) => `• ${c.name} (${c.state}) - ${c.image || "Unknown Image"}`).join("\n") ||
      "No containers found.";

    return text(`📦 Containers on server "${args.server}":\n\n${containerList}`);
  },
});

// ============================================================================
// Inspect
// ============================================================================

export const inspectContainerTool = defineTool({
  name: "komodo_container_inspect",
  description:
    "Get detailed low-level information about a container. Returns Docker inspect data including configuration, state, network settings, mounts, and process info.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_INSPECT),
  }),
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "inspectContainer",
      () => komodo.client.read("InspectDockerContainer", { server: args.server, container: args.container }),
      abortSignal,
    );
    return text(JSON.stringify(result, null, 2));
  },
});

// ============================================================================
// Logs
// ============================================================================

export const getContainerLogsTool = defineTool({
  name: "komodo_container_logs",
  description:
    "Get stdout and stderr logs from a container. Useful for debugging, monitoring application output, and troubleshooting issues.",
  input: z.object({
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
  }),
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();

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

    let logContent = "";
    if (result.stdout) {
      logContent += result.stdout;
    }
    if (result.stderr) {
      if (logContent) logContent += "\n\n=== STDERR ===\n";
      logContent += result.stderr;
    }

    return text(
      formatLogsResponse({
        containerName: args.container,
        serverName: args.server,
        logs: logContent,
        lines: args.tail,
      }),
    );
  },
});

// ============================================================================
// Search Logs
// ============================================================================

export const searchContainerLogsTool = defineTool({
  name: "komodo_container_search_logs",
  description:
    "Search container logs for specific patterns or keywords. Retrieves logs and filters them client-side. Returns matching lines with a count of matches.",
  input: z.object({
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
  }),
  annotations: { readOnlyHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.READ],
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();

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

    const logContent = result.stdout + (result.stderr ? "\n" + result.stderr : "");
    const lines = logContent.split("\n");
    const query = args.caseSensitive ? args.query : args.query.toLowerCase();

    const filteredLines = lines.filter((line) => {
      const searchLine = args.caseSensitive ? line : line.toLowerCase();
      return searchLine.includes(query);
    });

    return text(
      formatSearchResponse({
        containerName: args.container,
        serverName: args.server,
        query: args.query,
        matchCount: filteredLines.length,
        matches: filteredLines.join("\n"),
      }),
    );
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
  annotations: { idempotentHint: true },
  _meta: { category: ToolCategories.CONTAINER },
  requiredScopes: [ToolScopes.OPERATE],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const apiAction = CONTAINER_ACTION_API_MAP[args.action];
    const update = await wrapExecuteAndPoll(
      `${args.action}Container`,
      () => komodo.client.execute(apiAction, { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, args.action, "container", args.container, args.server));
  },
});
