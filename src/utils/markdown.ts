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

interface PageInfo {
  readonly next_cursor?: string;
  readonly total?: number;
}

/** Append a pagination footer line when more pages are available. */
function pageFooter(page: PageInfo | undefined, shown: number): string {
  if (!page) return "";
  if (page.next_cursor) {
    const total = page.total !== undefined ? ` of ${page.total}` : "";
    return `\n\n_Showing ${shown}${total}. More results available — pass \`cursor: "${page.next_cursor}"\` for the next page._`;
  }
  return "";
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

export function renderContainerList(payload: { items: readonly ContainerListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.CONTAINER} Containers (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo containers found.`;
  const rows = items.map((c) => `• ${c.name} (${stateBadge(c.state)}) — ${c.image ?? "Unknown image"}`).join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface ContainerInspectPayload {
  readonly summary: { readonly name: string };
  readonly inspect?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderContainerInspect(payload: ContainerInspectPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Container "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull Docker inspect payload available as resource: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.inspect)}`;
}

interface LogPayload {
  readonly summary: { readonly name: string };
  readonly stdout?: string;
  readonly stderr?: string;
  readonly resourceLink?: { readonly uri: string };
}

export function renderContainerLogs(payload: LogPayload): string {
  const header = `${RESPONSE_ICONS.LIST} Logs for container "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull stdout/stderr available as resource: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
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
  resourceLink?: { uri: string };
}): string {
  const { summary, matches, resourceLink } = payload;
  const header = `${RESPONSE_ICONS.LIST} Search results in container "${summary.name}"`;
  const countLine = `Found ${matches.length} matching ${matches.length === 1 ? "line" : "lines"}`;
  if (matches.length === 0) return `${header}\n\n${countLine}`;
  if (resourceLink) {
    return `${header}\n\n${countLine}\n\nFull match list available as resource: ${resourceLink.uri}`;
  }
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

export function renderServerList(payload: { items: readonly ServerListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.SERVER} Available servers (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo servers found.`;
  const rows = items
    .map((s) => {
      const version = s.version ?? "N/A";
      const region = s.region ? ` | Region: ${s.region}` : "";
      return `• ${s.name} (${s.id}) — Status: ${stateBadge(s.state)} | Version: ${version}${region}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface ServerInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderServerInfo(payload: ServerInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Server "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull server resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

export function renderServerStats(payload: { server: string; status: string }): string {
  return `${RESPONSE_ICONS.SERVER} Server "${payload.server}" status\n\n• Status: ${stateBadge(payload.status)}`;
}

// ============================================================================
// Build
// ============================================================================

interface BuildListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly version?: string;
  readonly builder_id?: string;
  readonly repo?: string;
  readonly branch?: string;
  readonly last_built_at?: number;
}

export function renderBuildList(payload: { items: readonly BuildListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.BUILD} Builds (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo builds found.`;
  const rows = items
    .map((b) => {
      const version = b.version ? ` v${b.version}` : "";
      const repo = b.repo ? ` | ${b.repo}${b.branch ? `@${b.branch}` : ""}` : "";
      return `• ${b.name} (${b.id})${version} — ${stateBadge(b.state)}${repo}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface BuildInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderBuildInfo(payload: BuildInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Build "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull build resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

interface BuildLogsPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly update_id: string;
  readonly success: boolean;
  readonly status: string;
  readonly logs?: readonly Log[];
  readonly resourceLink?: { readonly uri: string };
}

export function renderBuildLogs(payload: BuildLogsPayload): string {
  const header = `${RESPONSE_ICONS.BUILD} Build logs for "${payload.summary.name}" (${payload.update_id})`;
  const meta = `Status: ${payload.status} — ${payload.success ? "✅ Success" : "❌ Failed"}`;
  if (payload.resourceLink) {
    return `${header}\n\n${meta}\n\nFull per-stage logs available as resource: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  if (!payload.logs || payload.logs.length === 0) {
    return `${header}\n\n${meta}\n\n(No logs recorded)`;
  }
  const blocks = payload.logs.map((l) => {
    const stageHead = `**[${l.stage}]** ${l.success ? "✅" : "❌"}${l.command ? ` — \`${l.command}\`` : ""}`;
    const out = l.stdout ? `\n\nstdout:\n\n${codeBlock(truncate(l.stdout, OUTPUT_BUDGET))}` : "";
    const err = l.stderr ? `\n\nstderr:\n\n${codeBlock(truncate(l.stderr, OUTPUT_BUDGET))}` : "";
    return `${stageHead}${out}${err}`;
  });
  return `${header}\n\n${meta}\n\n${blocks.join("\n\n")}`;
}

// ============================================================================
// Repo
// ============================================================================

interface RepoListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly server_id?: string;
  readonly builder_id?: string;
  readonly repo?: string;
  readonly branch?: string;
  readonly cloned_hash?: string;
  readonly built_hash?: string;
  readonly latest_hash?: string;
}

export function renderRepoList(payload: { items: readonly RepoListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.REPO} Repos (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo repos found.`;
  const rows = items
    .map((r) => {
      const repo = r.repo ? ` | ${r.repo}${r.branch ? `@${r.branch}` : ""}` : "";
      const hashes: string[] = [];
      if (r.cloned_hash) hashes.push(`cloned ${r.cloned_hash}`);
      if (r.built_hash) hashes.push(`built ${r.built_hash}`);
      if (r.latest_hash) hashes.push(`latest ${r.latest_hash}`);
      const hashLine = hashes.length > 0 ? ` (${hashes.join(", ")})` : "";
      return `• ${r.name} (${r.id}) — ${stateBadge(r.state)}${repo}${hashLine}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface RepoInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderRepoInfo(payload: RepoInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Repo "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull repo resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

// ============================================================================
// Procedure
// ============================================================================

interface ProcedureListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly stages?: number;
  readonly last_run_at?: number;
  readonly next_scheduled_run?: number;
  readonly schedule_error?: string;
}

export function renderProcedureList(payload: { items: readonly ProcedureListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.PROCEDURE} Procedures (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo procedures found.`;
  const rows = items
    .map((p) => {
      const stages = p.stages !== undefined ? ` | ${p.stages} stage${p.stages === 1 ? "" : "s"}` : "";
      const sched = p.next_scheduled_run ? ` | next ${new Date(p.next_scheduled_run).toISOString()}` : "";
      const err = p.schedule_error ? ` | schedule_error: ${p.schedule_error}` : "";
      return `• ${p.name} (${p.id}) — ${stateBadge(p.state)}${stages}${sched}${err}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface ProcedureInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderProcedureInfo(payload: ProcedureInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Procedure "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull procedure resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

// ============================================================================
// Action
// ============================================================================

interface ActionListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly last_run_at?: number;
  readonly next_scheduled_run?: number;
  readonly schedule_error?: string;
}

export function renderActionList(payload: { items: readonly ActionListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.ACTION} Actions (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo actions found.`;
  const rows = items
    .map((a) => {
      const sched = a.next_scheduled_run ? ` | next ${new Date(a.next_scheduled_run).toISOString()}` : "";
      const err = a.schedule_error ? ` | schedule_error: ${a.schedule_error}` : "";
      return `• ${a.name} (${a.id}) — ${stateBadge(a.state)}${sched}${err}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface ActionInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderActionInfo(payload: ActionInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Action "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull Action resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

// ============================================================================
// Alerter
// ============================================================================

interface AlerterListItem {
  readonly id: string;
  readonly name: string;
  readonly enabled?: boolean;
  readonly endpoint_type?: string;
}

export function renderAlerterList(payload: { items: readonly AlerterListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.ALERTER} Alerters (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo alerters configured.`;
  const rows = items
    .map((a) => {
      const enabled = a.enabled === undefined ? "" : a.enabled ? " | enabled" : " | disabled";
      const ep = a.endpoint_type ? ` | ${a.endpoint_type}` : "";
      return `• ${a.name} (${a.id})${ep}${enabled}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface AlerterInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderAlerterInfo(payload: AlerterInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Alerter "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull alerter resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
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

export function renderDeploymentList(payload: { items: readonly DeploymentListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.DEPLOYMENT} Deployments (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo deployments found.`;
  const rows = items
    .map((d) => {
      const server = d.server_id ? ` | Server: ${d.server_id}` : "";
      return `• ${d.name} (${d.id}) — State: ${stateBadge(d.state)}${server}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface DeploymentInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderDeploymentInfo(payload: DeploymentInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Deployment "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull deployment resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
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

export function renderStackList(payload: { items: readonly StackListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.STACK} Stacks (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo stacks found.`;
  const rows = items
    .map((s) => {
      const server = s.server_id ? ` | Server: ${s.server_id}` : "";
      return `• ${s.name} (${s.id}) — State: ${stateBadge(s.state)}${server}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface StackInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderStackInfo(payload: StackInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Stack "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull stack resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
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

export function renderApiKeyList(payload: { items: readonly ApiKeyListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.AUTH} API keys (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo API keys.`;
  const rows = items
    .map((k) => {
      const created = new Date(k.created_at).toISOString().slice(0, 10);
      const expires = k.expires === 0 ? "never" : new Date(k.expires).toISOString().slice(0, 10);
      return `• ${k.name} — Key: \`${k.key}\` | Created: ${created} | Expires: ${expires}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
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

// ============================================================================
// Swarm
// ============================================================================

interface SwarmListItem {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly server_ids?: readonly string[];
  readonly err?: string;
}

export function renderSwarmList(payload: { items: readonly SwarmListItem[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.SWARM} Swarms (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo swarms registered.`;
  const rows = items
    .map((s) => {
      const state = s.state ? ` ${stateBadge(s.state)}` : "";
      const servers = s.server_ids && s.server_ids.length > 0 ? ` | managers: ${s.server_ids.length}` : "";
      const err = s.err ? ` | err: ${s.err}` : "";
      return `• ${s.name} (${s.id})${state}${servers}${err}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface SwarmInfoPayload {
  readonly summary: { readonly id: string; readonly name: string; readonly server_ids?: readonly string[] };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderSwarmInfo(payload: SwarmInfoPayload): string {
  const header = `${RESPONSE_ICONS.INFO} Swarm "${payload.summary.name}"`;
  const meta: string[] = [];
  if (payload.summary.server_ids && payload.summary.server_ids.length > 0) {
    meta.push(`• Manager servers (${payload.summary.server_ids.length}): ${payload.summary.server_ids.join(", ")}`);
  }
  const metaBlock = meta.length > 0 ? `\n\n${meta.join("\n")}` : "";
  if (payload.resourceLink) {
    return `${header}${metaBlock}\n\nFull swarm resource available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}${metaBlock}\n\n${jsonBlock(payload.info)}`;
}

interface SwarmNodeItem {
  readonly id?: string;
  readonly name?: string;
  readonly hostname?: string;
  readonly role?: string;
  readonly availability?: string;
  readonly state?: string;
}

export function renderSwarmNodesList(payload: {
  swarm: string;
  items: readonly SwarmNodeItem[];
  page?: PageInfo;
}): string {
  const { swarm, items, page } = payload;
  const header = `${RESPONSE_ICONS.NODE} Nodes for swarm "${swarm}" (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo nodes reported.`;
  const rows = items
    .map((n) => {
      const id = n.id ? ` (${n.id})` : "";
      const role = n.role ? ` | ${n.role}` : "";
      const avail = n.availability ? ` | ${n.availability}` : "";
      const state = n.state ? ` | ${stateBadge(n.state)}` : "";
      const host = n.hostname && n.hostname !== n.name ? ` | host: ${n.hostname}` : "";
      return `• ${n.name ?? n.hostname ?? "(unnamed)"}${id}${role}${avail}${state}${host}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface SwarmServiceItem {
  readonly id?: string;
  readonly name?: string;
  readonly image?: string;
  readonly mode?: string;
  readonly replicas?: number;
}

export function renderSwarmServicesList(payload: {
  swarm: string;
  items: readonly SwarmServiceItem[];
  page?: PageInfo;
}): string {
  const { swarm, items, page } = payload;
  const header = `${RESPONSE_ICONS.SERVICE} Services on swarm "${swarm}" (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo services running.`;
  const rows = items
    .map((s) => {
      const id = s.id ? ` (${s.id})` : "";
      const img = s.image ? ` | ${s.image}` : "";
      const mode = s.mode ? ` | ${s.mode}` : "";
      const rep = s.replicas !== undefined ? ` | replicas: ${s.replicas}` : "";
      return `• ${s.name ?? "(unnamed)"}${id}${img}${mode}${rep}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

// ============================================================================
// Variable
// ============================================================================

interface VariableSummary {
  readonly name: string;
  readonly value: string;
  readonly description?: string;
  readonly is_secret?: boolean;
}

export function renderVariableList(payload: { items: readonly VariableSummary[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.VARIABLE} Variables (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo variables defined.`;
  const rows = items
    .map((v) => {
      const secret = v.is_secret ? " 🔒" : "";
      const desc = v.description ? ` — ${v.description}` : "";
      const value = v.is_secret ? "(secret)" : v.value === "" ? "_(empty)_" : v.value;
      return `• \`${v.name}\`${secret} = ${value}${desc}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

export function renderVariableInfo(payload: { variable: VariableSummary }): string {
  const { variable } = payload;
  const secret = variable.is_secret ? " 🔒 secret" : "";
  const lines = [
    `${RESPONSE_ICONS.VARIABLE} Variable \`${variable.name}\`${secret}`,
    "",
    `• Value: ${variable.is_secret ? "(secret)" : variable.value === "" ? "_(empty)_" : `\`${variable.value}\``}`,
  ];
  if (variable.description) lines.push(`• Description: ${variable.description}`);
  return lines.join("\n");
}

// ============================================================================
// ResourceSync
// ============================================================================

interface ResourceSyncListItemRender {
  readonly id: string;
  readonly name: string;
  readonly state?: string;
  readonly managed?: boolean;
  readonly repo?: string;
  readonly branch?: string;
  readonly resource_path?: readonly string[];
  readonly last_sync_ts?: number;
  readonly last_sync_hash?: string;
}

export function renderResourceSyncList(payload: {
  items: readonly ResourceSyncListItemRender[];
  page?: PageInfo;
}): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.SYNC} Resource Syncs (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo resource syncs registered.`;
  const rows = items
    .map((s) => {
      const repo = s.repo ? ` | ${s.repo}${s.branch ? `@${s.branch}` : ""}` : "";
      const managed = s.managed ? " | managed" : "";
      const hash = s.last_sync_hash ? ` | last ${s.last_sync_hash}` : "";
      return `• ${s.name} (${s.id}) — ${stateBadge(s.state)}${managed}${repo}${hash}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface ResourceSyncInfoPayload {
  readonly summary: { readonly id: string; readonly name: string };
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderResourceSyncInfo(payload: ResourceSyncInfoPayload): string {
  const header = `${RESPONSE_ICONS.SYNC} Resource Sync "${payload.summary.name}"`;
  if (payload.resourceLink) {
    return `${header}\n\nFull resource sync payload available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${jsonBlock(payload.info)}`;
}

// ============================================================================
// Update (history)
// ============================================================================

interface UpdateSummaryRender {
  readonly id: string;
  readonly operation: string;
  readonly status: string;
  readonly success?: boolean;
  readonly start_ts?: number;
  readonly end_ts?: number;
  readonly target_type?: string;
  readonly target_id?: string;
  readonly username?: string;
}

function formatTs(ts: number | undefined): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
  } catch {
    return String(ts);
  }
}

export function renderUpdateList(payload: { items: readonly UpdateSummaryRender[]; page?: PageInfo }): string {
  const { items, page } = payload;
  const header = `${RESPONSE_ICONS.UPDATE_LOG} Updates (${items.length})`;
  if (items.length === 0) return `${header}\n\nNo update history.`;
  const rows = items
    .map((u) => {
      const result = u.status === "Complete" ? (u.success ? "✅" : "❌") : u.status === "InProgress" ? "🔄" : "⏳";
      const target = u.target_type ? ` | ${u.target_type}${u.target_id ? `:${u.target_id}` : ""}` : "";
      const user = u.username ? ` by ${u.username}` : "";
      return `• ${result} ${u.operation} (${u.id}) — ${formatTs(u.start_ts)}${target}${user}`;
    })
    .join("\n");
  return `${header}\n\n${rows}${pageFooter(page, items.length)}`;
}

interface UpdateInfoPayload {
  readonly summary: UpdateSummaryRender;
  readonly info?: unknown;
  readonly resourceLink?: { readonly uri: string };
}

export function renderUpdateInfo(payload: UpdateInfoPayload): string {
  const { summary } = payload;
  const header = `${RESPONSE_ICONS.UPDATE_LOG} Update ${summary.id} — ${summary.operation}`;
  const meta = [
    `• Status: ${summary.status}${summary.success !== undefined ? ` (${summary.success ? "✅ success" : "❌ failed"})` : ""}`,
    `• Started: ${formatTs(summary.start_ts)}`,
    summary.end_ts ? `• Ended: ${formatTs(summary.end_ts)}` : null,
    summary.target_type ? `• Target: ${summary.target_type}${summary.target_id ? `:${summary.target_id}` : ""}` : null,
    summary.username ? `• User: ${summary.username}` : null,
  ]
    .filter((v): v is string => v !== null)
    .join("\n");
  if (payload.resourceLink) {
    return `${header}\n\n${meta}\n\nFull update payload (per-stage logs) available at: \`${payload.resourceLink.uri}\` (request via \`resources/read\`).`;
  }
  return `${header}\n\n${meta}\n\n${jsonBlock(payload.info)}`;
}
