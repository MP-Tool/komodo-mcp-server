/**
 * Response Formatter
 *
 * Provides testable functions for formatting tool response messages.
 * Extracts template-string formatting from tool handlers.
 *
 * @module utils/response-formatter
 */

import { RESPONSE_ICONS } from '../config/index.js';

/**
 * Action types for formatting
 */
export type ActionType =
  | 'deploy'
  | 'pull'
  | 'start'
  | 'restart'
  | 'pause'
  | 'unpause'
  | 'stop'
  | 'destroy'
  | 'create'
  | 'update'
  | 'remove';

/**
 * Resource types for formatting
 */
export type ResourceType = 'stack' | 'deployment' | 'container' | 'server';

/**
 * Mapping of action types to their emoji icons
 */
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

/**
 * Mapping of action types to past tense verb
 */
const ACTION_PAST_TENSE: Record<ActionType, string> = {
  deploy: 'deployed',
  pull: 'pull initiated',
  start: 'started',
  restart: 'restarted',
  pause: 'paused',
  unpause: 'unpaused',
  stop: 'stopped',
  destroy: 'destroyed',
  create: 'created',
  update: 'updated',
  remove: 'removed',
};

/**
 * Options for formatting an action response
 */
export interface ActionResponseOptions {
  /** The type of action performed */
  action: ActionType;
  /** The type of resource */
  resourceType: ResourceType;
  /** The name/id of the resource */
  resourceId: string;
  /** Optional update ID from Komodo */
  updateId?: string;
  /** Optional status message */
  status?: string;
  /** Optional server name (for container actions) */
  serverName?: string;
}

/**
 * Formats an action response message consistently.
 *
 * @param options - The formatting options
 * @returns Formatted response string
 */
export function formatActionResponse(options: ActionResponseOptions): string {
  const { action, resourceType, resourceId, updateId, status, serverName } = options;

  const icon = ACTION_ICONS[action];
  const pastTense = ACTION_PAST_TENSE[action];

  // Capitalize resource type
  const resourceLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  // Build the main message
  let message: string;
  if (serverName) {
    message = `${icon} ${resourceLabel} "${resourceId}" ${pastTense} on server "${serverName}".`;
  } else {
    message = `${icon} ${resourceLabel} "${resourceId}" ${pastTense}.`;
  }

  // Add update ID and status if available
  const details: string[] = [];
  if (updateId) {
    details.push(`Update ID: ${updateId}`);
  }
  if (status) {
    details.push(`Status: ${status}`);
  }

  if (details.length > 0) {
    message += '\n\n' + details.join('\n');
  }

  return message;
}

/**
 * Options for formatting a list response
 */
export interface ListResponseOptions {
  /** The type of resource being listed */
  resourceType: ResourceType;
  /** The count of items */
  count: number;
  /** Optional server filter */
  serverName?: string;
}

/**
 * Formats a list response header.
 *
 * @param options - The formatting options
 * @returns Formatted header string
 */
export function formatListHeader(options: ListResponseOptions): string {
  const { resourceType, count, serverName } = options;
  const icon = RESPONSE_ICONS.LIST;
  const plural = count === 1 ? resourceType : `${resourceType}s`;

  if (serverName) {
    return `${icon} Found ${count} ${plural} on server "${serverName}"`;
  }
  return `${icon} Found ${count} ${plural}`;
}

/**
 * Options for formatting an info response
 */
export interface InfoResponseOptions {
  /** The type of resource */
  resourceType: ResourceType;
  /** The name/id of the resource */
  resourceId: string;
  /** The info content */
  content: string;
  /** Optional server name */
  serverName?: string;
}

/**
 * Formats an info response.
 *
 * @param options - The formatting options
 * @returns Formatted info string
 */
export function formatInfoResponse(options: InfoResponseOptions): string {
  const { resourceType, resourceId, content, serverName } = options;
  const icon = RESPONSE_ICONS.INFO;
  const resourceLabel = resourceType.charAt(0).toUpperCase() + resourceType.slice(1);

  let header: string;
  if (serverName) {
    header = `${icon} ${resourceLabel} "${resourceId}" on server "${serverName}"`;
  } else {
    header = `${icon} ${resourceLabel} "${resourceId}"`;
  }

  return `${header}\n\n${content}`;
}

/**
 * Options for formatting an error response
 */
export interface ErrorResponseOptions {
  /** The operation that failed */
  operation: string;
  /** The error message */
  message: string;
  /** Optional resource details */
  resourceId?: string;
  /** Optional resource type */
  resourceType?: ResourceType;
}

/**
 * Formats an error response.
 *
 * @param options - The formatting options
 * @returns Formatted error string
 */
export function formatErrorResponse(options: ErrorResponseOptions): string {
  const { operation, message, resourceId, resourceType } = options;
  const icon = RESPONSE_ICONS.ERROR;

  let details = `${icon} ${operation} failed`;
  if (resourceType && resourceId) {
    details += ` for ${resourceType} "${resourceId}"`;
  }

  return `${details}: ${message}`;
}

/**
 * Options for formatting logs response
 */
export interface LogsResponseOptions {
  /** Container name */
  containerName: string;
  /** Server name */
  serverName: string;
  /** The log content */
  logs: string;
  /** Number of lines */
  lines?: number;
}

/**
 * Formats a logs response.
 *
 * @param options - The formatting options
 * @returns Formatted logs string
 */
export function formatLogsResponse(options: LogsResponseOptions): string {
  const { containerName, serverName, logs, lines } = options;

  let header = `📋 Logs for container "${containerName}" on server "${serverName}"`;
  if (lines !== undefined) {
    header += ` (last ${lines} lines)`;
  }

  if (!logs || logs.trim() === '') {
    return `${header}\n\n(No logs available)`;
  }

  return `${header}\n\n\`\`\`\n${logs}\n\`\`\``;
}

/**
 * Options for formatting search results
 */
export interface SearchResponseOptions {
  /** Container name */
  containerName: string;
  /** Server name */
  serverName: string;
  /** Search query */
  query: string;
  /** Number of matches */
  matchCount: number;
  /** The matching lines */
  matches: string;
}

/**
 * Formats a search response.
 *
 * @param options - The formatting options
 * @returns Formatted search results string
 */
export function formatSearchResponse(options: SearchResponseOptions): string {
  const { containerName, serverName, query, matchCount, matches } = options;

  const header = `🔍 Search results for "${query}" in container "${containerName}" on server "${serverName}"`;
  const countLine = `Found ${matchCount} matching ${matchCount === 1 ? 'line' : 'lines'}`;

  if (matchCount === 0 || !matches.trim()) {
    return `${header}\n\n${countLine}`;
  }

  return `${header}\n\n${countLine}\n\n\`\`\`\n${matches}\n\`\`\``;
}

/**
 * Options for formatting prune response
 */
export interface PruneResponseOptions {
  /** The target of pruning */
  target: string;
  /** Server name */
  serverName: string;
  /** Operation details/output */
  output?: string;
}

/**
 * Formats a prune response.
 *
 * @param options - The formatting options
 * @returns Formatted prune string
 */
export function formatPruneResponse(options: PruneResponseOptions): string {
  const { target, serverName, output } = options;
  const icon = RESPONSE_ICONS.PRUNE;

  let message = `${icon} Pruned ${target} on server "${serverName}"`;

  if (output) {
    message += `\n\n${output}`;
  }

  return message;
}
