/**
 * Response Formatter
 *
 * Consistent formatting for tool response messages.
 *
 * @module utils/response-formatter
 */

import { RESPONSE_ICONS } from "../config/index.js";

export type ActionType =
  | "deploy"
  | "pull"
  | "start"
  | "restart"
  | "pause"
  | "unpause"
  | "stop"
  | "destroy"
  | "create"
  | "update"
  | "remove";

export type ResourceType = "stack" | "deployment" | "container" | "server";

const ACTION_ICONS: Record<ActionType, string> = {
  deploy: RESPONSE_ICONS.DEPLOY,
  pull: RESPONSE_ICONS.PULL,
  start: RESPONSE_ICONS.START,
  restart: RESPONSE_ICONS.RESTART,
  pause: RESPONSE_ICONS.PAUSE,
  unpause: RESPONSE_ICONS.UNPAUSE,
  stop: RESPONSE_ICONS.STOP,
  destroy: RESPONSE_ICONS.DELETE,
  create: RESPONSE_ICONS.CREATE,
  update: RESPONSE_ICONS.UPDATE,
  remove: RESPONSE_ICONS.DELETE,
};

const ACTION_PAST_TENSE: Record<ActionType, string> = {
  deploy: "deployed",
  pull: "pull initiated",
  start: "started",
  restart: "restarted",
  pause: "paused",
  unpause: "unpaused",
  stop: "stopped",
  destroy: "destroyed",
  create: "created",
  update: "updated",
  remove: "removed",
};

export interface ActionResponseOptions {
  action: ActionType;
  resourceType: ResourceType;
  resourceId: string;
  updateId?: string;
  status?: string;
  serverName?: string;
}

export function formatActionResponse(options: ActionResponseOptions): string {
  const { action, resourceType, resourceId, updateId, status, serverName } = options;
  const icon = ACTION_ICONS[action];
  const pastTense = ACTION_PAST_TENSE[action];
  const resourceLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  let message: string;
  if (serverName) {
    message = `${icon} ${resourceLabel} "${resourceId}" ${pastTense} on server "${serverName}".`;
  } else {
    message = `${icon} ${resourceLabel} "${resourceId}" ${pastTense}.`;
  }

  const details: string[] = [];
  if (updateId) details.push(`Update ID: ${updateId}`);
  if (status) details.push(`Status: ${status}`);
  if (details.length > 0) message += "\n\n" + details.join("\n");

  return message;
}

export interface ListResponseOptions {
  resourceType: ResourceType;
  count: number;
  serverName?: string;
}

export function formatListHeader(options: ListResponseOptions): string {
  const { resourceType, count, serverName } = options;
  const icon = RESPONSE_ICONS.LIST;
  const plural = count === 1 ? resourceType : `${resourceType}s`;

  if (serverName) return `${icon} Found ${count} ${plural} on server "${serverName}"`;
  return `${icon} Found ${count} ${plural}`;
}

export interface InfoResponseOptions {
  resourceType: ResourceType;
  resourceId: string;
  content: string;
  serverName?: string;
}

export function formatInfoResponse(options: InfoResponseOptions): string {
  const { resourceType, resourceId, content, serverName } = options;
  const icon = RESPONSE_ICONS.INFO;
  const resourceLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  const header = serverName
    ? `${icon} ${resourceLabel} "${resourceId}" on server "${serverName}"`
    : `${icon} ${resourceLabel} "${resourceId}"`;

  return `${header}\n\n${content}`;
}

export interface ErrorResponseOptions {
  operation: string;
  message: string;
  resourceId?: string;
  resourceType?: ResourceType;
}

export function formatErrorResponse(options: ErrorResponseOptions): string {
  const { operation, message, resourceId, resourceType } = options;
  const icon = RESPONSE_ICONS.ERROR;

  let details = `${icon} ${operation} failed`;
  if (resourceType && resourceId) details += ` for ${resourceType} "${resourceId}"`;
  return `${details}: ${message}`;
}

export interface LogsResponseOptions {
  containerName: string;
  serverName: string;
  logs: string;
  lines?: number;
}

export function formatLogsResponse(options: LogsResponseOptions): string {
  const { containerName, serverName, logs, lines } = options;

  let header = `📋 Logs for container "${containerName}" on server "${serverName}"`;
  if (lines !== undefined) header += ` (last ${lines} lines)`;

  if (!logs || logs.trim() === "") return `${header}\n\n(No logs available)`;
  return `${header}\n\n\`\`\`\n${logs}\n\`\`\``;
}

export interface SearchResponseOptions {
  containerName: string;
  serverName: string;
  query: string;
  matchCount: number;
  matches: string;
}

export function formatSearchResponse(options: SearchResponseOptions): string {
  const { containerName, serverName, query, matchCount, matches } = options;

  const header = `🔍 Search results for "${query}" in container "${containerName}" on server "${serverName}"`;
  const countLine = `Found ${matchCount} matching ${matchCount === 1 ? "line" : "lines"}`;

  if (matchCount === 0 || !matches.trim()) return `${header}\n\n${countLine}`;
  return `${header}\n\n${countLine}\n\n\`\`\`\n${matches}\n\`\`\``;
}

export interface PruneResponseOptions {
  target: string;
  serverName: string;
  output?: string;
}

export function formatPruneResponse(options: PruneResponseOptions): string {
  const { target, serverName, output } = options;
  const icon = RESPONSE_ICONS.PRUNE;

  let message = `${icon} Pruned ${target} on server "${serverName}"`;
  if (output) message += `\n\n${output}`;
  return message;
}
