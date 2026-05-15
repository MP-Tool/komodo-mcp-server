/**
 * Utilities Module
 *
 * Consolidated utilities for the Komodo MCP Server:
 * - API helpers: client access, cancellation, error wrapping
 * - Polling: execute-and-poll workflow with progress reporting
 * - Response formatting: Markdown formatter for state-change tools without
 *   an `output` schema (`*_create`, `*_update`, `*_delete`)
 * - Markdown renderers: compact `TextContent` views for typed tools that
 *   emit `structuredContent` via the framework's `structured()` helper
 *
 * @module utils
 */

// --- API Helpers ---
export { requireClient, checkCancelled, wrapApiCall } from "./api-helpers.js";

// --- Resource Links (ephemeral session-bound payloads) ---
export { tryRegisterResource } from "./resource-link.js";
export type { ResourceCategory, ResourceLinkContext, RegisterResourceOptions } from "./resource-link.js";

// --- Polling ---
export { extractUpdateId, wrapExecuteAndPoll, buildActionResult } from "./polling.js";
export type { ActionResult } from "./polling.js";

// --- Pagination (client-side cursor-based slicing) ---
export { paginate, encodeCursor, decodeCursor, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./pagination.js";
export type { PageEnvelope, PaginateResult } from "./pagination.js";

// --- Response Formatting ---
export {
  formatActionResponse,
  buildApplyResult,
  buildDeleteResult,
  type ActionType,
  type ResourceType,
  type ActionResponseOptions,
} from "./response-formatter.js";

// --- Markdown Renderers (typed tools) ---
export {
  renderContainerList,
  renderContainerInspect,
  renderContainerLogs,
  renderContainerSearchLogs,
  renderServerList,
  renderServerInfo,
  renderServerStats,
  renderBuildList,
  renderBuildInfo,
  renderBuildLogs,
  renderRepoList,
  renderRepoInfo,
  renderProcedureList,
  renderProcedureInfo,
  renderActionList,
  renderActionInfo,
  renderAlerterList,
  renderAlerterInfo,
  renderSwarmList,
  renderSwarmInfo,
  renderSwarmNodesList,
  renderSwarmServicesList,
  renderDeploymentList,
  renderDeploymentInfo,
  renderStackList,
  renderStackInfo,
  renderActionResult,
  renderExecResult,
  renderApiKeyList,
  renderApiKeyCreated,
  renderHealthCheck,
  renderVariableList,
  renderVariableInfo,
  renderResourceSyncList,
  renderResourceSyncInfo,
  renderUpdateList,
  renderUpdateInfo,
} from "./markdown.js";
