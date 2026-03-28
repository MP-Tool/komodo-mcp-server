/**
 * Container Tools
 *
 * Tools for listing, inspecting, managing, and monitoring Docker containers.
 *
 * @module tools/container
 */

import { defineTool, text, z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { PARAM_DESCRIPTIONS, CONTAINER_LOGS_DEFAULTS, LOG_DESCRIPTIONS, LOG_SEARCH_DEFAULTS } from "../config/index.js";
import {
  formatLogsResponse,
  formatSearchResponse,
  formatPruneResponse,
  requireClient,
  wrapApiCall,
  wrapExecuteAndPoll,
  formatUpdateResult,
} from "../utils/index.js";
import { pruneTargetSchema, containerActionSchema, serverIdSchema, containerNameSchema } from "./schemas/index.js";

type ContainerListItem = Types.ContainerListItem;
type Log = Types.Log;

// ============================================================================
// List
// ============================================================================

export const listContainersTool = defineTool({
  name: "komodo_list_containers",
  description:
    "List all containers on a server, including running, stopped, and paused containers. Shows container name, state, and image.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_TO_LIST_CONTAINERS),
  }),
  annotations: { readOnlyHint: true },
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
  name: "komodo_inspect_container",
  description:
    "Get detailed low-level information about a container. Returns Docker inspect data including configuration, state, network settings, mounts, and process info.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_INSPECT),
  }),
  annotations: { readOnlyHint: true },
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
  name: "komodo_get_container_logs",
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
  name: "komodo_search_logs",
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
// Prune
// ============================================================================

/** Maps prune target names to Komodo API action names */
const PRUNE_ACTION_MAP: Record<string, string> = {
  containers: "PruneContainers",
  images: "PruneImages",
  volumes: "PruneVolumes",
  networks: "PruneNetworks",
  system: "PruneSystem",
};

export const pruneResourcesTool = defineTool({
  name: "komodo_prune",
  description:
    "Prune unused resources on a server. This permanently removes stopped containers, unused images, volumes, or networks to free up resources.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    pruneTarget: pruneTargetSchema,
  }),
  annotations: { destructiveHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();

    if (args.pruneTarget === "all") {
      const targets = ["containers", "images", "volumes", "networks"] as const;
      for (const target of targets) {
        await wrapExecuteAndPoll(
          `prune${target}`,
          () => komodo.client.execute(PRUNE_ACTION_MAP[target] as "PruneContainers", { server: args.server }),
          abortSignal,
          reportProgress,
        );
      }
      return text(
        formatPruneResponse({
          target: args.pruneTarget,
          serverName: args.server,
          output: "All resources pruned successfully",
        }),
      );
    }

    const action = PRUNE_ACTION_MAP[args.pruneTarget];
    const update = await wrapExecuteAndPoll(
      "pruneResources",
      () => komodo.client.execute(action as "PruneContainers", { server: args.server }),
      abortSignal,
      reportProgress,
    );
    return text(
      formatPruneResponse({
        target: args.pruneTarget,
        serverName: args.server,
        output: `Result: ${update.success ? "✅ Success" : "❌ Failed"} | Status: ${update.status}`,
      }),
    );
  },
});

// ============================================================================
// Lifecycle (start, stop, restart, pause, unpause)
// ============================================================================

export const startContainerTool = defineTool({
  name: "komodo_start_container",
  description: "Start a stopped or paused container. The container must exist and be in a stopped or paused state.",
  input: containerActionSchema,
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "startContainer",
      () => komodo.client.execute("StartContainer", { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "start", "container", args.container, args.server));
  },
});

export const stopContainerTool = defineTool({
  name: "komodo_stop_container",
  description: "Stop a running container gracefully. Sends SIGTERM first, then SIGKILL after timeout.",
  input: containerActionSchema,
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "stopContainer",
      () => komodo.client.execute("StopContainer", { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "stop", "container", args.container, args.server));
  },
});

export const restartContainerTool = defineTool({
  name: "komodo_restart_container",
  description:
    "Restart a container. Stops the container if running, then starts it again. Useful for applying configuration changes.",
  input: containerActionSchema,
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "restartContainer",
      () => komodo.client.execute("RestartContainer", { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "restart", "container", args.container, args.server));
  },
});

export const pauseContainerTool = defineTool({
  name: "komodo_pause_container",
  description:
    "Pause all processes in a running container using cgroups freezer. The container remains in memory but consumes no CPU cycles.",
  input: containerActionSchema,
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "pauseContainer",
      () => komodo.client.execute("PauseContainer", { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "pause", "container", args.container, args.server));
  },
});

export const unpauseContainerTool = defineTool({
  name: "komodo_unpause_container",
  description: "Resume a paused container. All processes that were frozen will continue execution.",
  input: containerActionSchema,
  annotations: { idempotentHint: true },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    const update = await wrapExecuteAndPoll(
      "unpauseContainer",
      () => komodo.client.execute("UnpauseContainer", { server: args.server, container: args.container }),
      abortSignal,
      reportProgress,
    );
    return text(formatUpdateResult(update, "unpause", "container", args.container, args.server));
  },
});
