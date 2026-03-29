/**
 * Utilities Module
 *
 * Consolidated utilities for the Komodo MCP Server:
 * - API helpers: client access, cancellation, error wrapping
 * - Polling: execute-and-poll workflow with progress reporting
 * - Response formatting: consistent message formatting for tool responses
 *
 * @module utils
 */

// --- API Helpers ---
export { requireClient, checkCancelled, wrapApiCall } from "./api-helpers.js";

// --- Polling ---
export { extractUpdateId, wrapExecuteAndPoll, formatUpdateResult } from "./polling.js";

// --- Response Formatting ---
export {
  formatActionResponse,
  formatCompletedActionResponse,
  formatListHeader,
  formatInfoResponse,
  formatErrorResponse,
  formatLogsResponse,
  formatSearchResponse,
  formatPruneResponse,
  type ActionType,
  type ResourceType,
  type ActionResponseOptions,
  type CompletedActionResponseOptions,
  type ListResponseOptions,
  type InfoResponseOptions,
  type ErrorResponseOptions,
  type LogsResponseOptions,
  type SearchResponseOptions,
  type PruneResponseOptions,
} from "./response-formatter.js";
