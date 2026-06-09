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

import { defineTool, structured } from "mcp-server-framework";
import type { ProgressReporter } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ToolCategories, ToolScopes } from "../config/index.js";
import { AppErrorFactory } from "../errors/index.js";
import { execInputSchema, execOutputSchema } from "./schemas/index.js";
import { requireClient, wrapApiCall, renderExecResult } from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

/** Maximum output length returned to the client (characters) */
const MAX_OUTPUT_LENGTH = 50_000;

/** Maximum time to wait for a terminal command to complete (5 minutes) */
const TERMINAL_TIMEOUT_MS = 300_000;

/** Report progress every N lines of output */
const PROGRESS_INTERVAL = 50;

/** Estimated total lines based on max output capacity (for progress reporting) */
const ESTIMATED_TOTAL_LINES = Math.ceil(MAX_OUTPUT_LENGTH / 80);

/** Sentinel prefix emitted by Komodo to signal exit code*/
const EXIT_CODE_PREFIX = "__KOMODO_EXIT_CODE:";

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

/**
 * Collects output from an async iterable stream (server terminals).
 * Parses the Komodo exit-code sentinel from the stream.
 */
async function collectStreamOutput(
  stream: AsyncIterable<string>,
  signal?: AbortSignal,
  reportProgress?: ProgressReporter,
): Promise<TerminalResult> {
  const buf = new OutputBuffer();

  for await (const line of stream) {
    if (!buf.isActive(signal)) break;

    if (line.startsWith(EXIT_CODE_PREFIX)) {
      buf.exitCode = parseExitCode(line.slice(EXIT_CODE_PREFIX.length));
      continue;
    }

    if (!buf.addLine(line)) break;
    await buf.reportProgress(reportProgress);
  }

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

    switch (args.target) {
      case "server": {
        if (!args.server) throw AppErrorFactory.validation.fieldRequired("server");
        const server = args.server;
        const stream = await wrapApiCall(
          "executeServerTerminal",
          () =>
            komodo.client.execute_terminal_stream({
              target: { type: "Server", params: { server } },
              terminal: args.terminal,
              command: args.command,
              // Wrap the init shell with `stty -echo` to disable PTY input echo.
              // Komodo Periphery sends its command scaffold as a multi-line string
              // to the PTY. Without this, the PTY echoes each scaffold line back
              // into stdout and the sentinel-matching loop in Periphery fires on
              // the echo rather than on the real printf output — causing the stream
              // to close before the actual command output arrives.
              // Workaround until upstream fix: `\n` to `\\n` in the scaffold printf format literal, or a dedicated exec API without the scaffold.
              init: {
                command: `sh -c 'stty -echo; exec ${args.shell}'`,
                recreate: Types.TerminalRecreateMode.DifferentCommand,
              },
            }),
          abortSignal,
        );
        const result = await collectStreamOutput(stream, abortSignal, reportProgress);
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
        if (!args.server) throw AppErrorFactory.validation.fieldRequired("server");
        if (!args.container) throw AppErrorFactory.validation.fieldRequired("container");
        const server = args.server;
        const container = args.container;
        const result = await wrapApiCall(
          "executeContainerExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_container_exec(
                  {
                    server,
                    container,
                    shell: args.shell,
                    command: args.command,
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
        if (!args.deployment) throw AppErrorFactory.validation.fieldRequired("deployment");
        const deployment = args.deployment;
        const result = await wrapApiCall(
          "executeDeploymentExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_deployment_exec(
                  {
                    deployment,
                    shell: args.shell,
                    command: args.command,
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
        if (!args.stack) throw AppErrorFactory.validation.fieldRequired("stack");
        if (!args.service) throw AppErrorFactory.validation.fieldRequired("service");
        const stack = args.stack;
        const service = args.service;
        const result = await wrapApiCall(
          "executeStackServiceExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_stack_exec(
                  {
                    stack,
                    service,
                    shell: args.shell,
                    command: args.command,
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
