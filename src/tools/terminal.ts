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
import { ToolCategories, ToolScopes } from "../config/index.js";
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

/** Sentinel prefix emitted by Komodo to signal exit code */
const EXIT_CODE_PREFIX = "__KOMODO_EXIT_CODE__:";

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
    return { output: this.lines.join("\n"), exitCode: this.exitCode, truncated: this.truncated };
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
      buf.exitCode = line.slice(EXIT_CODE_PREFIX.length).trim();
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

  const execPromise = execFn({
    onLine: (line: string) => {
      if (!buf.isActive(signal)) return;
      buf.addLine(line);
      if (reportProgress) void buf.reportProgress(reportProgress);
    },
    onFinish: (code: string) => {
      buf.exitCode = code;
    },
  }).then(() => buf.getResult());

  const timeoutPromise = new Promise<TerminalResult>((resolve) => {
    const timer = setTimeout(() => {
      buf.markTimeout();
      resolve(buf.getResult());
    }, TERMINAL_TIMEOUT_MS);
    // Clean up timer when exec finishes first to avoid leaking
    void execPromise.then(() => clearTimeout(timer));
  });

  return Promise.race([execPromise, timeoutPromise]);
}

// ============================================================================
// Consolidated `komodo_exec` Tool
// ============================================================================

export const execTool = defineTool({
  name: "komodo_exec",
  description:
    "Execute a shell command on a Komodo target. Use the `target` discriminator to choose the execution context:\n" +
    "- `server` — host shell via Periphery terminal (requires `server`, optional `terminal`)\n" +
    "- `container` — inside a running Docker container (requires `server` + `container`, optional `shell`)\n" +
    "- `deployment` — inside the container of a Komodo deployment (requires `deployment`, optional `shell`)\n" +
    "- `stack_service` — inside a service container of a Compose stack (requires `stack` + `service`, optional `shell`)\n\n" +
    "Returns stdout/stderr output and exit code. Output is truncated at 50KB; commands time out after 5 minutes.",
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
        const stream = await wrapApiCall(
          "executeServerTerminal",
          () =>
            komodo.client.execute_terminal_stream({
              target: { type: "Server", params: { server: args.server } },
              terminal: args.terminal,
              command: args.command,
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
          server: args.server,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }

      case "container": {
        const result = await wrapApiCall(
          "executeContainerExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_container_exec(
                  {
                    server: args.server,
                    container: args.container,
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
          server: args.server,
          container: args.container,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }

      case "deployment": {
        const result = await wrapApiCall(
          "executeDeploymentExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_deployment_exec(
                  {
                    deployment: args.deployment,
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
          deployment: args.deployment,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }

      case "stack_service": {
        const result = await wrapApiCall(
          "executeStackServiceExec",
          () =>
            collectCallbackOutput(
              (callbacks) =>
                komodo.client.execute_stack_exec(
                  {
                    stack: args.stack,
                    service: args.service,
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
          stack: args.stack,
          service: args.service,
        };
        return structured(payload, { text: renderExecResult(payload) });
      }
    }
  },
});
