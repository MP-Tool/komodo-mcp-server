/**
 * Markdown Renderers
 *
 * Human-readable Markdown renderers for typed tools. Each renderer takes the
 * same payload that the tool emits as `structuredContent` and produces a
 * detailed Markdown view (header, bullet list, fenced code blocks with the
 * actual data) that mirrors the pre-1.4 response format. Modern MCP clients
 * render the Markdown for users while consuming `structuredContent` as the
 * canonical machine-readable payload; legacy clients see the same Markdown
 * instead of a raw JSON dump.
 *
 * Wired via `structured(payload, { text: renderXyz(payload) })` in the
 * tool handlers.
 *
 * @module utils/markdown
 */

import type { Types } from "komodo_client";
import { RESPONSE_ICONS } from "../config/index.js";
import type { ActionType } from "./response-formatter.js";

type Log = Types.Log;

// ============================================================================
// Primitives
// ============================================================================

/** Truncation budget for log/output blocks embedded in Markdown text. */
const OUTPUT_BUDGET = 4000;

/** Map a state value to an emoji prefix for at-a-glance status. */
function stateBadge(state: string | undefined): string {
  if (!state) return "—";
  const s = state.toLowerCase();
  if (s === "running" || s === "ok" || s === "healthy") return `🟢 ${state}`;
  if (s === "paused") return `⏸️ ${state}`;
  if (s === "restarting") return `🔄 ${state}`;
  if (s === "exited" || s === "stopped" || s === "dead") return `🔴 ${state}`;
  if (s === "created") return `⚪ ${state}`;
  if (s === "unhealthy" || s === "disabled") return `🟠 ${state}`;
  return state;
}

/** Truncate a string to `max` characters with a trailing ellipsis note. */
function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n…(${value.length - max} more chars truncated)`;
}

/** Render a value inside a fenced code block. Empty values produce a placeholder. */
function codeBlock(value: string, language = ""): string {
  if (!value || value.trim() === "") return "_(empty)_";
  return `\`\`\`${language}\n${value}\n\`\`\``;
}

/** Pretty-print an unknown payload as JSON inside a fenced ` ```json ` block. */
function jsonBlock(value: unknown): string {
  try {
    return codeBlock(JSON.stringify(value, null, 2), "json");
  } catch {
    return "_(payload not serializable)_";
  }
}

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

// ============================================================================
// Container
// ============================================================================

interface ContainerListItem {
  readonly name: string;
  readonly state?: string;
  readonly image?: string;
}

export function renderContainerList(payload: { items: readonly ContainerListItem[] }): string {
  const { items } = payload;
  const header = `${RESPONSE_ICONS.CONTAINER} Containers (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo containers found.`;
  const rows = items.map((c) => `• ${c.name} (${stateBadge(c.state)}) — ${c.image ?? "Unknown image"}`).join("\n");
  return `${header}\n\n${rows}`;
}

interface ContainerInspectPayload {
  readonly summary: { readonly name: string };
  readonly inspect: unknown;
}

export function renderContainerInspect(payload: ContainerInspectPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Container "${payload.summary.name}"`;
  return `${header}\n\n${jsonBlock(payload.inspect)}`;
}

interface LogPayload {
  readonly summary: { readonly name: string };
  readonly stdout?: string;
  readonly stderr?: string;
}

export function renderContainerLogs(payload: LogPayload): string {
  const header = `${RESPONSE_ICONS.LIST} Logs for container "${payload.summary.name}"`;
  const stdout = payload.stdout ?? "";
  const stderr = payload.stderr ?? "";
  if (!stdout && !stderr) return `${header}\n\n(No logs available)`;

  const blocks: string[] = [];
  if (stdout) blocks.push(`**stdout**\n\n${codeBlock(truncate(stdout, OUTPUT_BUDGET))}`);
  if (stderr) blocks.push(`**stderr**\n\n${codeBlock(truncate(stderr, OUTPUT_BUDGET))}`);
  return `${header}\n\n${blocks.join("\n\n")}`;
}

interface SearchMatch {
  readonly stream: "stdout" | "stderr";
  readonly line: string;
}

export function renderContainerSearchLogs(payload: {
  summary: { name: string };
  matches: readonly SearchMatch[];
}): string {
  const { summary, matches } = payload;
  const header = `${RESPONSE_ICONS.LIST} Search results in container "${summary.name}"`;
  const countLine = `Found ${matches.length} matching ${matches.length === 1 ? "line" : "lines"}`;
  if (matches.length === 0) return `${header}\n\n${countLine}`;
  const body = matches.map((m) => `[${m.stream}] ${m.line}`).join("\n");
  return `${header}\n\n${countLine}\n\n${codeBlock(truncate(body, OUTPUT_BUDGET))}`;
}

// ============================================================================
// Server
// ============================================================================

interface ServerListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly version?: string;
  readonly region?: string;
}

export function renderServerList(payload: { items: readonly ServerListItem[] }): string {
  const { items } = payload;
  const header = `${RESPONSE_ICONS.SERVER} Available servers (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo servers found.`;
  const rows = items
    .map((s) => {
      const version = s.version ?? "N/A";
      const region = s.region ? ` | Region: ${s.region}` : "";
      return `• ${s.name} (${s.id}) — Status: ${stateBadge(s.state)} | Version: ${version}${region}`;
    })
    .join("\n");
  return `${header}\n\n${rows}`;
}

interface ServerInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info: unknown;
}

export function renderServerInfo(payload: ServerInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Server "${payload.summary.name}"`;
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

export function renderServerStats(payload: { server: string; status: string }): string {
  return `${RESPONSE_ICONS.SERVER} Server "${payload.server}" status\n\n• Status: ${stateBadge(payload.status)}`;
}

// ============================================================================
// Deployment
// ============================================================================

interface DeploymentListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly server_id?: string;
}

export function renderDeploymentList(payload: { items: readonly DeploymentListItem[] }): string {
  const { items } = payload;
  const header = `${RESPONSE_ICONS.DEPLOYMENT} Deployments (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo deployments found.`;
  const rows = items
    .map((d) => {
      const server = d.server_id ? ` | Server: ${d.server_id}` : "";
      return `• ${d.name} (${d.id}) — State: ${stateBadge(d.state)}${server}`;
    })
    .join("\n");
  return `${header}\n\n${rows}`;
}

interface DeploymentInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info: unknown;
}

export function renderDeploymentInfo(payload: DeploymentInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Deployment "${payload.summary.name}"`;
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

// ============================================================================
// Stack
// ============================================================================

interface StackListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly server_id?: string;
}

export function renderStackList(payload: { items: readonly StackListItem[] }): string {
  const { items } = payload;
  const header = `${RESPONSE_ICONS.STACK} Stacks (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo stacks found.`;
  const rows = items
    .map((s) => {
      const server = s.server_id ? ` | Server: ${s.server_id}` : "";
      return `• ${s.name} (${s.id}) — State: ${stateBadge(s.state)}${server}`;
    })
    .join("\n");
  return `${header}\n\n${rows}`;
}

interface StackInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info: unknown;
}

export function renderStackInfo(payload: StackInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Stack "${payload.summary.name}"`;
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

// ============================================================================
// Action Result (lifecycle + prune)
// ============================================================================

interface ActionResultPayload {
  readonly success: boolean;
  readonly status: string;
  readonly action: string;
  readonly resource_type: string;
  readonly resource_id: string;
  readonly server?: string;
  readonly version?: string;
}

/**
 * Optional context that augments the rendered text but is not part of the
 * canonical `structuredContent` payload.
 *
 * - `updateId`: Komodo Update ID (for traceability in the UI).
 * - `logs`: Update log entries (stdout/stderr per stage). The renderer picks
 *   the most relevant entries (last 2 on success, all failed/stderr on
 *   failure) and embeds them as fenced code blocks.
 */
export interface ActionResultExtras {
  readonly updateId?: string;
  readonly logs?: readonly Log[];
}

export function renderActionResult(payload: ActionResultPayload, extras?: ActionResultExtras): string {
  const baseAction = (payload.action.split("-")[0] ?? payload.action) as ActionType;
  const knownAction = baseAction in ACTION_ICONS;
  const icon = payload.success
    ? knownAction
      ? ACTION_ICONS[baseAction]
      : RESPONSE_ICONS.SUCCESS
    : RESPONSE_ICONS.ERROR;
  const pastTense = knownAction ? ACTION_PAST_TENSE[baseAction] : payload.action;
  const outcome = payload.success ? pastTense : `${payload.action} failed`;
  const resourceLabel = payload.resource_type.charAt(0).toUpperCase() + payload.resource_type.slice(1);

  const headline =
    payload.server && payload.server !== payload.resource_id
      ? `${icon} ${resourceLabel} "${payload.resource_id}" ${outcome} on server "${payload.server}".`
      : `${icon} ${resourceLabel} "${payload.resource_id}" ${outcome}.`;

  const details: string[] = [];
  details.push(`Result: ${payload.success ? "✅ Success" : "❌ Failed"}`);
  details.push(`Status: ${payload.status}`);
  if (extras?.updateId) details.push(`Update ID: ${extras.updateId}`);
  if (payload.version) details.push(`Version: ${payload.version}`);

  let message = `${headline}\n\n${details.join("\n")}`;

  if (extras?.logs && extras.logs.length > 0) {
    const relevant = payload.success
      ? extras.logs.filter((l) => l.stdout.trim() || l.stderr.trim()).slice(-2)
      : extras.logs.filter((l) => !l.success || l.stderr.trim());

    if (relevant.length > 0) {
      message += `\n\n${payload.success ? "📋 Output:" : "📋 Error details:"}`;
      for (const log of relevant) {
        if (log.stage) message += `\n\n[${log.stage}]`;
        const output = log.stderr.trim() || log.stdout.trim();
        if (output) message += `\n${codeBlock(truncate(output, 1000))}`;
      }
    }
  }

  return message;
}

// ============================================================================
// Terminal Exec
// ============================================================================

interface ExecPayload {
  readonly target: "server" | "container" | "deployment" | "stack_service";
  readonly command: string;
  readonly output: string;
  readonly exit_code: string | null;
  readonly truncated: boolean;
  readonly server?: string;
  readonly container?: string;
  readonly deployment?: string;
  readonly stack?: string;
  readonly service?: string;
}

export function renderExecResult(payload: ExecPayload): string {
  const targetLabel = (() => {
    switch (payload.target) {
      case "server":
        return `server "${payload.server}"`;
      case "container":
        return `container "${payload.container}" on server "${payload.server}"`;
      case "deployment":
        return `deployment "${payload.deployment}"`;
      case "stack_service":
        return `stack "${payload.stack}" · service "${payload.service}"`;
    }
  })();

  const exit = payload.exit_code ?? "—";
  const exitIcon = payload.exit_code === "0" ? RESPONSE_ICONS.SUCCESS : RESPONSE_ICONS.ERROR;
  const truncatedNote = payload.truncated ? " _(truncated)_" : "";

  const header = `${RESPONSE_ICONS.START} Exec on ${targetLabel}`;
  const meta = `\`$ ${payload.command}\`\n\n${exitIcon} Exit code: ${exit}${truncatedNote}`;
  const body = payload.output ? `\n\n${codeBlock(truncate(payload.output, OUTPUT_BUDGET))}` : "\n\n_(no output)_";

  return `${header}\n\n${meta}${body}`;
}

// ============================================================================
// API Keys
// ============================================================================

interface ApiKeyListItem {
  readonly name: string;
  readonly key: string;
  readonly created_at: number;
  readonly expires: number;
}

export function renderApiKeyList(payload: { items: readonly ApiKeyListItem[] }): string {
  const { items } = payload;
  const header = `${RESPONSE_ICONS.AUTH} API keys (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo API keys.`;
  const rows = items
    .map((k) => {
      const created = new Date(k.created_at).toISOString().slice(0, 10);
      const expires = k.expires === 0 ? "never" : new Date(k.expires).toISOString().slice(0, 10);
      return `• ${k.name} — Key: \`${k.key}\` | Created: ${created} | Expires: ${expires}`;
    })
    .join("\n");
  return `${header}\n\n${rows}`;
}

export function renderApiKeyCreated(payload: { name: string; key: string; secret: string; expires: number }): string {
  const expires = payload.expires === 0 ? "never" : new Date(payload.expires).toISOString().slice(0, 10);
  const header = `${RESPONSE_ICONS.SUCCESS} API key "${payload.name}" created.`;
  const details = [
    `Key: \`${payload.key}\``,
    `Secret: \`${payload.secret}\` _(shown only on creation — store it now)_`,
    `Expires: ${expires}`,
  ].join("\n");
  return `${header}\n\n${details}`;
}

// ============================================================================
// Health Check
// ============================================================================

interface HealthCheckPayload {
  readonly configured: boolean;
  readonly healthy: boolean;
  readonly server?: string;
  readonly komodo_version?: string;
  readonly mcp_server_version: string;
  readonly error?: string;
}

export function renderHealthCheck(payload: HealthCheckPayload): string {
  if (!payload.configured) {
    const lines = [
      `${RESPONSE_ICONS.WARNING} Komodo not configured.`,
      "",
      `MCP server: v${payload.mcp_server_version}`,
      "",
      "_Run `komodo_configure` to connect to a Komodo instance._",
    ];
    return lines.join("\n");
  }

  const icon = payload.healthy ? RESPONSE_ICONS.SUCCESS : RESPONSE_ICONS.ERROR;
  const verdict = payload.healthy ? "healthy" : "unhealthy";
  const server = payload.server ?? "(unknown)";
  const lines = [`${icon} Komodo ${verdict} — ${server}`, ""];
  if (payload.komodo_version) lines.push(`• Komodo version: v${payload.komodo_version}`);
  lines.push(`• MCP server version: v${payload.mcp_server_version}`);
  if (payload.error) lines.push(`• Error: ${payload.error}`);
  return lines.join("\n");
}
