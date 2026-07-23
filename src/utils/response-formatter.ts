/**
 * Response Formatter
 *
 * Markdown formatter for state-change tools (`*_create`, `*_update`, `*_delete`)
 * that do not declare an `output` schema. Typed tools serialize their payload
 * via the framework's `structured()` helper instead.
 *
 * @module utils/response-formatter
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { structured, type ResourceLinkSpec } from "mcp-server-framework";
import { RESPONSE_ICONS } from "../config/index.js";
import { tryRegisterResource, type RegisterResourceOptions } from "./resource-link.js";

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

export type ResourceType =
  | "stack"
  | "deployment"
  | "container"
  | "server"
  | "build"
  | "repo"
  | "procedure"
  | "action"
  | "alerter"
  | "swarm"
  | "variable"
  | "resource_sync"
  | "api_key";

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

/**
 * Build a structured payload + rendered text for a `*_apply` tool result.
 *
 * Pairs with `applyResultSchema` from `tools/schemas/shared.ts`. The handler
 * is expected to feed the return value into `structured(payload, { text })`.
 */
export function buildApplyResult(
  action: "create" | "update",
  resourceType: ResourceType,
  resourceId: string,
  result: unknown,
): {
  payload: {
    action: "create" | "update";
    resource_type: string;
    resource_id: string;
    resource?: Record<string, unknown>;
  };
  text: string;
} {
  const header = formatActionResponse({ action, resourceType, resourceId });
  const resource = result && typeof result === "object" ? (result as Record<string, unknown>) : undefined;
  return {
    payload: {
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      ...(resource ? { resource } : {}),
    },
    text: `${header}\n\n${JSON.stringify(result, null, 2)}`,
  };
}

/**
 * Build a structured payload + rendered text for a `*_delete` tool result.
 *
 * Pairs with `deleteResultSchema` from `tools/schemas/shared.ts`.
 */
export function buildDeleteResult(
  resourceType: ResourceType,
  resourceId: string,
  result: unknown,
): {
  payload: { action: "remove"; resource_type: string; resource_id: string; resource?: Record<string, unknown> };
  text: string;
} {
  const header = formatActionResponse({ action: "remove", resourceType, resourceId });
  const resource = result && typeof result === "object" ? (result as Record<string, unknown>) : undefined;
  return {
    payload: {
      action: "remove",
      resource_type: resourceType,
      resource_id: resourceId,
      ...(resource ? { resource } : {}),
    },
    text: `${header}\n\n${JSON.stringify(result, null, 2)}`,
  };
}

/**
 * Build a `CallToolResult` for a `*_info` tool: register the content for
 * resource-link offload and assemble the summary + (resourceLink | info)
 * payload consumed by the handler's renderer.
 *
 * Secret redaction is NOT this builder's job: inline results pass the
 * framework's central tool-result boundary, and offloaded content is scrubbed
 * on register by the `DynamicResourceRegistry` (both wired in `src/index.ts`).
 *
 * Pairs with the various `*InfoOutputSchema` shapes across `tools/schemas`.
 */
export function buildInfoResult<S extends object>(input: {
  result: unknown;
  summary: S;
  register: {
    ctx: { sessionId?: string | undefined };
    name: string;
    ttlMs: number;
    inlineFull?: boolean | undefined;
    description: string;
  };
  render: (payload: { summary: S } & ({ info: unknown } | { resourceLink: ResourceLinkSpec })) => string;
}): CallToolResult {
  const link = tryRegisterResource({
    ctx: input.register.ctx,
    category: "info",
    name: input.register.name,
    mimeType: "application/json",
    content: JSON.stringify(input.result, null, 2),
    ttlMs: input.register.ttlMs,
    inlineFull: input.register.inlineFull,
    description: input.register.description,
  } satisfies RegisterResourceOptions);
  const payload = link
    ? { summary: input.summary, resourceLink: link }
    : { summary: input.summary, info: input.result };
  return structured(payload, { text: input.render(payload), ...(link ? { links: [link] } : {}) });
}
