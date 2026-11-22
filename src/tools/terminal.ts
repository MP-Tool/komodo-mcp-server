/**
 * Terminal Execution Tool
 *
 * Consolidated `komodo_exec` tool for executing commands on Komodo servers,
 * containers, deployments, and stack services via the `komodo_client` terminal API.
 *
 * Two execution models share a common output collector:
 * - **Stream-based**: `execute_terminal_stream()` for server terminals (AsyncIterable)
 * - **Callback-based**: `execute_*_exec()` for container/deployment/stack exec (onLine/onFinish)
 *
 * Both share the {@link OutputBuffer} for output collection, truncation,
 * timeout enforcement, and progress reporting.
 *
 * @module tools/terminal
 */

import { randomUUID } from "node:crypto";
import { defineTool, logger, structured } from "mcp-server-framework";
import type { ProgressReporter } from "mcp-server-framework";
import { Types } from "komodo_client";
import { KomodoRequestError, type KomodoApi } from "../client.js";
import { ToolCategories, ToolScopes } from "../config/index.js";
import { ValidationError } from "../errors/index.js";
import { execInputSchema, execOutputSchema } from "./schemas/index.js";
import {
  requireClient,
  requireKomodoPermission,
  requireDestructiveConfirmation,
  requireMinimalVersion,
  readCoreVersion,
  KOMODO_MINIMAL_API_VERSION,
  wrapApiCall,
  checkCancelled,
  renderExecResult,
} from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

/** Maximum output length returned to the client (characters) */
const MAX_OUTPUT_LENGTH = 50_000;

/** Maximum time to wait for a terminal command to complete (5 minutes) */
const TERMINAL_TIMEOUT_MS = 300_000;

/** Independent limit for creating or deleting an isolated terminal. */
const TERMINAL_MANAGEMENT_TIMEOUT_MS = 5_000;

/** Give a delayed CreateTerminal request time to reach Periphery before retrying deletion. */
const TERMINAL_CLEANUP_RETRY_DELAY_MS = 5_000;

/** Report progress every N lines of output */
const PROGRESS_INTERVAL = 50;

/** Estimated total lines based on max output capacity (for progress reporting) */
const ESTIMATED_TOTAL_LINES = Math.ceil(MAX_OUTPUT_LENGTH / 80);

/** Sentinel prefix emitted by Komodo to signal exit code*/
const EXIT_CODE_PREFIX = "__KOMODO_EXIT_CODE:";

/**
 * Build the terminal init shell with PTY input echo disabled.
 *
 * Komodo Periphery sends its command scaffold as a multi-line string to the
 * PTY. Without `stty -echo`, the PTY echoes each scaffold line back into stdout
 * and Periphery's sentinel-matching loop fires on the echo rather than on the
 * real `printf` output — so the stream closes before the actual command output
 * arrives, returning the echoed scaffold with no exit code. Disabling echo makes
 * the sentinel match the real output. Used by every target so container,
 * deployment and stack_service exec behave like the server terminal.
 *
 * Workaround until upstream fix: `\n` to `\\n` in the scaffold printf format
 * literal, or a dedicated exec API without the scaffold.
 */
function echoSuppressedInit(shell: string): Types.InitTerminal {
  return {
    command: `sh -c 'stty -echo; exec ${shell}'`,
    recreate: Types.TerminalRecreateMode.DifferentCommand,
  };
}

/**
 * Parses and validates a raw exit-code value from the Komodo sentinel.
 *
 * The PTY echo can inject the printf format literal `"%d"` or other
 * non-numeric strings before the real sentinel arrives. Any value that
 * is not a valid integer is treated as unknown and returned as `null`.
 */
function parseExitCode(raw: string): string | null {
  const trimmed = raw.trim();
  return /^-?\d+$/.test(trimmed) ? trimmed : null;
}

// ============================================================================
// Output Collection
// ============================================================================

interface TerminalResult {
  readonly output: string;
  readonly exitCode: string | null;
  readonly truncated: boolean;
}

/**
 * Buffers terminal output with truncation, timeout, and progress reporting.
 *
 * Shared between stream-based (server terminals) and callback-based
 * (container/deployment/stack exec) collection methods.
 */
class OutputBuffer {
  private readonly lines: string[] = [];
  private readonly startTime = Date.now();
  private totalLength = 0;
  private truncated = false;
  private lineCount = 0;
  exitCode: string | null = null;

  /** Returns true if the buffer can still accept lines (not timed out, not aborted). */
  isActive(signal?: AbortSignal): boolean {
    return !signal?.aborted && !this.isTimedOut;
  }

  private get isTimedOut(): boolean {
    return Date.now() - this.startTime > TERMINAL_TIMEOUT_MS;
  }

  /** Append a line to the buffer. Returns false if timed out (caller should stop). */
  addLine(line: string): boolean {
    if (this.isTimedOut) {
      this.lines.push("... [timeout — command may still be running]");
      this.truncated = true;
      return false;
    }

    this.lineCount++;

    if (this.truncated) return true;

    this.totalLength += line.length + 1;
    if (this.totalLength > MAX_OUTPUT_LENGTH) {
      this.truncated = true;
      this.lines.push("... [output truncated]");
    } else {
      this.lines.push(line);
    }
    return true;
  }

  /** Report progress to the MCP client if the line threshold is reached. */
  async reportProgress(reporter?: ProgressReporter): Promise<void> {
    if (reporter && this.lineCount % PROGRESS_INTERVAL === 0) {
      await reporter({
        progress: Math.min(this.lineCount, ESTIMATED_TOTAL_LINES),
        total: ESTIMATED_TOTAL_LINES,
        message: `Received ${this.lineCount} lines...`,
      });
    }
  }

  /** Mark timeout (used by callback-based timeout race). */
  markTimeout(): void {
    this.lines.push("... [timeout — command may still be running]");
    this.truncated = true;
  }

  getResult(): TerminalResult {
    // Trim leading/trailing empty lines injected by Komodo's scaffold protocol
    // (printf outputs a \n before and after the sentinel lines). Internal blank
    // lines that are part of real command output are preserved.
    const output = this.lines.join("\n").trim();
    return { output, exitCode: this.exitCode, truncated: this.truncated };
  }
}

/** Execute a server command with a deadline and clean up terminals owned by this call. */
async function executeServerTerminal(
  api: KomodoApi,
  {
    server,
    shell,
    command,
    terminal: persistentName,
  }: { server: string; shell: string; command: string; terminal?: string | undefined },
  abortSignal: AbortSignal,
  reportProgress?: ProgressReporter,
): Promise<TerminalResult> {
  const operation = "executeServerTerminal";
  checkCancelled(abortSignal, operation);
  const target = { type: "Server", params: { server } } as const;
  const terminal = persistentName ?? `mcp-${randomUUID()}`;
  const init = echoSuppressedInit(shell);
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(), TERMINAL_TIMEOUT_MS);
  const signal = AbortSignal.any([abortSignal, deadline.signal]);
  const buf = new OutputBuffer();
  let reporting = false;
  let exitCode: string | null = null;
  let creation: "none" | "confirmed" | "uncertain" = persistentName === undefined ? "uncertain" : "none";

  try {
    if (persistentName === undefined) {
      // Create separately so a late execute request cannot recreate a deleted terminal.
      // Let creation settle even if the caller cancels, then delete with an independent signal.
      try {
        await api.write(
          "CreateTerminal",
          { target, name: terminal, ...init },
          AbortSignal.timeout(TERMINAL_MANAGEMENT_TIMEOUT_MS),
        );
        creation = "confirmed";
      } catch (error) {
        // These rejections occur before Core can create the terminal. Other failures may occur after delivery.
        if (error instanceof KomodoRequestError && [400, 401, 403, 404, 405, 409, 422].includes(error.status)) {
          creation = "none";
        } else {
          logger.warn("Could not confirm creation of isolated Komodo terminal %s on server %s", terminal, server);
        }
        throw error;
      }
    }

    signal.throwIfAborted();
    const stream = await api.execute_terminal_stream(
      { target, terminal, command, ...(persistentName !== undefined && { init }) },
      signal,
    );
    for await (const line of stream) {
      if (line.startsWith(EXIT_CODE_PREFIX)) {
        exitCode = parseExitCode(line.slice(EXIT_CODE_PREFIX.length));
      } else {
        if (!buf.addLine(line)) {
          exitCode = null;
          break;
        }
        if (reportProgress && !reporting) {
          reporting = true;
          void buf
            .reportProgress(reportProgress)
            .catch(() => {})
            .finally(() => {
              reporting = false;
            });
        }
      }
    }
    signal.throwIfAborted();
    // The shell can print a line that looks like the exit marker while the command is still running.
    buf.exitCode = exitCode;
  } catch (error) {
    checkCancelled(abortSignal, operation);
    if (!deadline.signal.aborted) throw error;
    buf.markTimeout();
  } finally {
    clearTimeout(timer);
    if (creation !== "none") {
      const deleteTerminal = async (): Promise<boolean> => {
        try {
          await api.write("DeleteTerminal", { target, terminal }, AbortSignal.timeout(TERMINAL_MANAGEMENT_TIMEOUT_MS));
          return true;
        } catch {
          logger.warn("Could not delete isolated Komodo terminal %s on server %s", terminal, server);
          return false;
        }
      };
      const deleted = await deleteTerminal();
      if (creation === "uncertain" || !deleted) {
        // Delete is idempotent. An earlier success may have found no terminal if creation was still in flight.
        setTimeout(() => void deleteTerminal(), TERMINAL_CLEANUP_RETRY_DELAY_MS).unref();
      }
    }
  }

  checkCancelled(abortSignal, operation);
  return buf.getResult();
}

/**
 * Collects output from a callback-based exec method (container/deployment/stack).
 * Wraps onLine/onFinish callbacks into a Promise with timeout guard.
 */
function collectCallbackOutput(
  execFn: (callbacks: { onLine: (line: string) => void; onFinish: (code: string) => void }) => Promise<void>,
  signal?: AbortSignal,
  reportProgress?: ProgressReporter,
): Promise<TerminalResult> {
  const buf = new OutputBuffer();
  let timer: NodeJS.Timeout | undefined;

  const execPromise = execFn({
    onLine: (line: string) => {
      if (!buf.isActive(signal)) return;
      buf.addLine(line);
      if (reportProgress) void buf.reportProgress(reportProgress);
    },
    onFinish: (code: string) => {
      buf.exitCode = parseExitCode(code);
    },
  })
    .finally(() => {
      if (timer) clearTimeout(timer);
    })
    .then(() => buf.getResult());

  const timeoutPromise = new Promise<TerminalResult>((resolve) => {
    timer = setTimeout(() => {
      buf.markTimeout();
      resolve(buf.getResult());
    }, TERMINAL_TIMEOUT_MS);
  });

  return Promise.race([execPromise, timeoutPromise]);
}

// ============================================================================
// Consolidated `komodo_exec` Tool
// ============================================================================

export const execTool = defineTool({
  name: "komodo_exec",
  description: [
    "Execute a shell command on a Komodo target. `target` selects the context:",
    "server (server[, shell, terminal]) | container (server, container[, shell]) | deployment (deployment[, shell]) | stack_service (stack, service[, shell]).",
    "Output ≤50 KB; timeout 5 min.",
  ].join("\n"),
  input: execInputSchema,
  output: execOutputSchema,
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  _meta: { category: ToolCategories.TERMINAL },
  requiredScopes: [ToolScopes.ADMIN],
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();
    requireMinimalVersion(await readCoreVersion(), KOMODO_MINIMAL_API_VERSION, "komodo_exec");
    // Shown in the confirmation prompt — keep it recognizable but bounded.
    const commandPreview = args.command.length > 200 ? `${args.command.slice(0, 200)}…` : args.command;

    switch (args.target) {
      case "server": {
        if (!args.server) throw ValidationError.fieldRequired("server");
        const server = args.server;
        await requireKomodoPermission({ type: "Server", id: server }, Types.PermissionLevel.Execute);
        await requireDestructiveConfirmation({
          action: "execute shell command on",
          resourceType: "server",
          resourceId: server,
          detail: `Command: ${commandPreview}`,
        });
        const result = await wrapApiCall(
          "executeServerTerminal",
          () => executeServerTerminal(komodo.client, { ...args, server }, abortSignal, reportProgress),
          abortSignal,
        );
        const payload = {
          target: "server" as const,
          command: args.command,
          output: result.output,
          exit_code: result.exitCode,
          truncated: result.truncated,
          server,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }

      case "container": {
        if (!args.server) throw ValidationError.fieldRequired("server");
        if (!args.container) throw ValidationError.fieldRequired("container");
        const server = args.server;
        const container = args.container;
        await requireKomodoPermission({ type: "Server", id: server }, Types.PermissionLevel.Execute);
        await requireDestructiveConfirmation({
          action: "execute shell command in",
          resourceType: "container",
          resourceId: container,
          detail: `On server "${server}"; command: ${commandPreview}`,
        });
        const result = await wrapApiCall(
          "executeContainerExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_container_terminal(
                  {
                    server,
                    container,
                    command: args.command,
                    // Suppress PTY echo so Periphery captures real stdout, not the
                    // echoed scaffold (returns command echo + null exit otherwise).
                    init: echoSuppressedInit(args.shell),
                  },
                  callbacks,
                ),
              abortSignal,
              reportProgress,
            ),
          abortSignal,
        );
        const payload = {
          target: "container" as const,
          command: args.command,
          output: result.output,
          exit_code: result.exitCode,
          truncated: result.truncated,
          server,
          container,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }

      case "deployment": {
        if (!args.deployment) throw ValidationError.fieldRequired("deployment");
        const deployment = args.deployment;
        await requireKomodoPermission({ type: "Deployment", id: deployment }, Types.PermissionLevel.Execute);
        await requireDestructiveConfirmation({
          action: "execute shell command in",
          resourceType: "deployment",
          resourceId: deployment,
          detail: `Command: ${commandPreview}`,
        });
        const result = await wrapApiCall(
          "executeDeploymentExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_deployment_terminal(
                  {
                    deployment,
                    command: args.command,
                    init: echoSuppressedInit(args.shell),
                  },
                  callbacks,
                ),
              abortSignal,
              reportProgress,
            ),
          abortSignal,
        );
        const payload = {
          target: "deployment" as const,
          command: args.command,
          output: result.output,
          exit_code: result.exitCode,
          truncated: result.truncated,
          deployment,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }

      case "stack_service": {
        if (!args.stack) throw ValidationError.fieldRequired("stack");
        if (!args.service) throw ValidationError.fieldRequired("service");
        const stack = args.stack;
        const service = args.service;
        await requireKomodoPermission({ type: "Stack", id: stack }, Types.PermissionLevel.Execute);
        await requireDestructiveConfirmation({
          action: "execute shell command in",
          resourceType: "stack service",
          resourceId: `${stack}/${service}`,
          detail: `Command: ${commandPreview}`,
        });
        const result = await wrapApiCall(
          "executeStackServiceExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_stack_service_terminal(
                  {
                    stack,
                    service,
                    command: args.command,
                    init: echoSuppressedInit(args.shell),
                  },
                  callbacks,
                ),
              abortSignal,
              reportProgress,
            ),
          abortSignal,
        );
        const payload = {
          target: "stack_service" as const,
          command: args.command,
          output: result.output,
          exit_code: result.exitCode,
          truncated: result.truncated,
          stack,
          service,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }
    }
  },
});
