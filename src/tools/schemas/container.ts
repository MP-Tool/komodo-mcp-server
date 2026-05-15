/**
 * Container Schemas
 *
 * Zod schemas for container tool inputs — lifecycle actions, log fetching, search.
 *
 * @module tools/schemas/container
 */

import { z } from "mcp-server-framework";
import { PARAM_DESCRIPTIONS } from "../../config/index.js";
import { serverIdSchema, containerNameSchema } from "./validators.js";
import { resourceLinkSchema, pageOutputSchema } from "./shared.js";

/** Identifies a container for lifecycle operations (start, stop, restart, pause, unpause) */
export const containerActionSchema = z
  .object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
  })
  .describe("Identifies a container for lifecycle operations (start, stop, restart, pause, unpause)");

/** Container lifecycle actions for the consolidated `komodo_container_action` tool */
export const containerActionEnum = z
  .enum(["start", "stop", "restart", "pause", "unpause"])
  .describe(
    "Lifecycle action: start (run a stopped/paused container), stop (stop a running container), restart (stop+start), pause (freeze processes), unpause (resume).",
  );

/** Input schema for the consolidated `komodo_container_action` tool */
export const containerActionInputSchema = z.object({
  action: containerActionEnum,
  server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
  container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
});

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single container as returned in list/inspect responses. */
export const containerSummarySchema = z.object({
  name: z.string().describe("Container name"),
  state: z.string().optional().describe("Container runtime state (running, exited, paused, ...) when known"),
  image: z.string().optional().describe("Image reference the container is running"),
});

/** Output of `komodo_container_list`. */
export const containerListOutputSchema = z
  .object({
    items: z.array(containerSummarySchema).describe("Containers on the target server"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of containers on a server");

/** Output of `komodo_container_inspect`. */
export const containerInspectOutputSchema = z
  .object({
    summary: containerSummarySchema,
    inspect: z.unknown().optional().describe("Raw Docker inspect payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Docker inspect data for a container");

/** Output of `komodo_container_logs`. */
export const containerLogsOutputSchema = z
  .object({
    summary: containerSummarySchema,
    stdout: z.string().optional().describe("Captured stdout content (may be truncated)"),
    stderr: z.string().optional().describe("Captured stderr content (may be truncated)"),
    truncated: z.boolean().optional().describe("True when the log output was truncated by the tail limit"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Container log output");

/** A single matched line in a log search response. */
export const logSearchMatchSchema = z.object({
  stream: z.enum(["stdout", "stderr"]).describe("Source stream of the matched line"),
  line: z.string().describe("Matched log line"),
  line_number: z.number().int().optional().describe("1-based line number within the searched window"),
});

/** Output of `komodo_container_search_logs`. */
export const containerSearchLogsOutputSchema = z
  .object({
    summary: containerSummarySchema,
    matches: z.array(logSearchMatchSchema).describe("Matched log lines"),
    truncated: z.boolean().optional().describe("True when the search window was truncated by the tail limit"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Log search results for a container");
