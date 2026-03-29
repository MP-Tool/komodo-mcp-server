/**
 * Terminal Execution Tools
 *
 * Tools for executing commands on Komodo servers, containers,
 * and stack services via the `komodo_client` terminal API.
 *
 * Two execution models:
 * - **Stream-based**: `execute_terminal_stream()` for server terminals (AsyncIterable)
 * - **Callback-based**: `execute_*_exec()` for container/deployment/stack exec (onLine/onFinish)
 *
 * Both share the {@link OutputBuffer} for output collection, truncation,
 * timeout enforcement, and progress reporting.
 *
 * @module tools/terminal
 */

import { defineTool, text, z } from "mcp-server-framework";
import type { ProgressReporter } from "mcp-server-framework";
import { PARAM_DESCRIPTIONS, VALIDATION_LIMITS } from "../config/index.js";
import { serverIdSchema, containerNameSchema, stackIdSchema, deploymentIdSchema } from "./schemas/index.js";
import { requireClient, wrapApiCall } from "../utils/index.js";

// ============================================================================
// Constants
// ============================================================================

/** Maximum output length returned to the client (characters) */
const MAX_OUTPUT_LENGTH = 50_000;

/** Maximum time to wait for a terminal command to complete (5 minutes) */
const TERMINAL_TIMEOUT_MS = 300_000;

/** Report progress every N lines of output */
const PROGRESS_INTERVAL = 50;

/** Sentinel prefix emitted by Komodo to signal exit code */
const EXIT_CODE_PREFIX = "__KOMODO_EXIT_CODE__:";

// ============================================================================
// Schemas
// ============================================================================

const commandSchema = z.string().min(1, "Command cannot be empty").max(4096, "Command is too long");

const shellSchema = z
  .string()
  .min(1, "Shell cannot be empty")
  .max(50, "Shell path is too long")
  .regex(/^[a-zA-Z0-9/_.-]+$/, "Shell contains invalid characters")
  .default("sh")
  .describe("The shell to use for execution (e.g. 'sh', 'bash', '/bin/zsh'). Default: sh");

const terminalNameSchema = z
  .string()
  .min(1, "Terminal name cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Terminal name is too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Terminal name contains invalid characters")
  .default("mcp")
  .describe("Terminal session name on the server. If it doesn't exist, it will be created. Default: mcp");

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
      await reporter({ progress: this.lineCount, message: `Received ${this.lineCount} lines...` });
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
// Response Formatting
// ============================================================================

function formatTerminalResponse(target: string, command: string, result: TerminalResult): string {
  const { output, exitCode, truncated } = result;

  const exitInfo =
    exitCode !== null
      ? exitCode === "0"
        ? "✅ Exit code: 0"
        : `❌ Exit code: ${exitCode}`
      : "⚠️ Exit code: unknown (stream ended early)";

  const truncateNote = truncated ? "\n⚠️ Output was truncated due to size." : "";
  const outputBlock = output.trim() ? `\`\`\`\n${output.trim()}\n\`\`\`` : "_No output_";

  return `🖥️ Command executed on ${target}\n\n**Command:** \`${command}\`\n${exitInfo}${truncateNote}\n\n${outputBlock}`;
}

// ============================================================================
// Server Terminal Execution
// ============================================================================

export const serverExecTool = defineTool({
  name: "komodo_server_exec",
  description:
    "Execute a shell command on a Komodo server via Periphery terminal. " +
    "The command runs on the host machine where the Periphery agent is installed. " +
    "Returns stdout/stderr output and exit code. Use for server diagnostics, file operations, or system commands.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    command: commandSchema.describe("The shell command to execute on the server"),
    terminal: terminalNameSchema,
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();

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
    return text(formatTerminalResponse(`server "${args.server}"`, args.command, result));
  },
});

// ============================================================================
// Container Exec
// ============================================================================

export const containerExecTool = defineTool({
  name: "komodo_container_exec",
  description:
    "Execute a command inside a running Docker container on a server. " +
    "Similar to 'docker exec'. Returns stdout/stderr output and exit code. " +
    "Use for container debugging, running maintenance commands, or checking application state.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
    command: commandSchema.describe("The command to execute inside the container"),
    shell: shellSchema,
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();

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

    return text(formatTerminalResponse(`container "${args.container}" on "${args.server}"`, args.command, result));
  },
});

// ============================================================================
// Deployment Exec
// ============================================================================

export const deploymentExecTool = defineTool({
  name: "komodo_deployment_exec",
  description:
    "Execute a command inside the container of a Komodo deployment. " +
    "Uses the deployment's associated container. Returns stdout/stderr output and exit code.",
  input: z.object({
    deployment: deploymentIdSchema.describe("Deployment ID or name to execute the command in"),
    command: commandSchema.describe("The command to execute inside the deployment container"),
    shell: shellSchema,
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();

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

    return text(formatTerminalResponse(`deployment "${args.deployment}"`, args.command, result));
  },
});

// ============================================================================
// Stack Service Exec
// ============================================================================

export const stackServiceExecTool = defineTool({
  name: "komodo_stack_service_exec",
  description:
    "Execute a command inside a specific service container of a Komodo stack. " +
    "Targets a single service within a Docker Compose stack. Returns stdout/stderr output and exit code.",
  input: z.object({
    stack: stackIdSchema.describe("Stack ID or name"),
    service: z
      .string()
      .min(1, "Service name cannot be empty")
      .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Service name is too long")
      .regex(/^[a-zA-Z0-9_.-]+$/, "Service name contains invalid characters")
      .describe("The service name within the stack to execute the command in"),
    command: commandSchema.describe("The command to execute inside the service container"),
    shell: shellSchema,
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: true,
  },
  handler: async (args, { abortSignal, reportProgress }) => {
    const komodo = requireClient();

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

    return text(formatTerminalResponse(`service "${args.service}" in stack "${args.stack}"`, args.command, result));
  },
});
