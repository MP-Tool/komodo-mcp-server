/**
 * Terminal Execution Schema
 *
 * Discriminated union over `target` for the consolidated `komodo_exec` tool.
 * Per-target fields differ (server: `terminal`; container: `server` + `container`;
 * deployment: `deployment`; stack_service: `stack` + `service`) so a flat
 * schema would obscure validity — Zod's discriminated union enforces
 * correctness at runtime and gives the LLM a precise schema.
 *
 * @module tools/schemas/terminal
 */

import { z } from "mcp-server-framework";
import { VALIDATION_LIMITS } from "../../config/index.js";
import { serverIdSchema, containerNameSchema, stackIdSchema, deploymentIdSchema } from "./validators.js";

/** Shell command to execute (max 4096 chars) */
export const execCommandSchema = z.string().min(1, "Command cannot be empty").max(4096, "Command is too long");

/** Shell binary path (e.g. `sh`, `bash`, `/bin/zsh`) */
export const execShellSchema = z
  .string()
  .min(1, "Shell cannot be empty")
  .max(50, "Shell path is too long")
  .regex(/^[a-zA-Z0-9/_.-]+$/, "Shell contains invalid characters")
  .default("sh")
  .describe("The shell to use for execution (e.g. 'sh', 'bash', '/bin/zsh'). Default: sh");

/** Terminal session name on a server (used for `target: 'server'`) */
export const execTerminalNameSchema = z
  .string()
  .min(1, "Terminal name cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Terminal name is too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Terminal name contains invalid characters")
  .default("mcp")
  .describe("Terminal session name on the server. If it doesn't exist, it will be created. Default: mcp");

/** Service name within a stack (used for `target: 'stack_service'`) */
const execServiceNameSchema = z
  .string()
  .min(1, "Service name cannot be empty")
  .max(VALIDATION_LIMITS.MAX_RESOURCE_NAME_LENGTH, "Service name is too long")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Service name contains invalid characters")
  .describe("The service name within the stack to execute the command in");

/**
 * Flat input schema for `komodo_exec`.
 *
 * Replaces `z.discriminatedUnion("target", …)` so MCP Inspector and other UI
 * clients render the form. The handler validates per-target required fields
 * at runtime via `AppErrorFactory.validation.fieldRequired`.
 *
 * - `server`        — requires `server` + `command`
 * - `container`     — requires `server` + `container` + `command`
 * - `deployment`    — requires `deployment` + `command`
 * - `stack_service` — requires `stack` + `service` + `command`
 */
export const execInputSchema = z.object({
  target: z
    .enum(["server", "container", "deployment", "stack_service"])
    .describe("Execution context: server | container | deployment | stack_service"),
  command: execCommandSchema.describe("The shell command to execute"),
  // server / container
  server: serverIdSchema.optional().describe("Required for 'server' / 'container': Komodo server id or name"),
  terminal: execTerminalNameSchema,
  // container
  container: containerNameSchema.optional().describe("Required for 'container': container name or id"),
  // deployment
  deployment: deploymentIdSchema.optional().describe("Required for 'deployment': deployment id or name"),
  // stack_service
  stack: stackIdSchema.optional().describe("Required for 'stack_service': stack id or name"),
  service: execServiceNameSchema.optional(),
  // container / deployment / stack_service
  shell: execShellSchema,
});

// ============================================================================
// Output Schema
// ============================================================================

/**
 * Output of `komodo_exec`.
 *
 * Captures the executed target, the command, the collected stdout/stderr
 * stream as a single string, the exit code (when emitted by Komodo), and
 * a `truncated` flag set when output exceeded the buffer size or the
 * command timed out.
 */
export const execOutputSchema = z
  .object({
    target: z.enum(["server", "container", "deployment", "stack_service"]).describe("Execution context that ran"),
    command: z.string().describe("The shell command that was executed"),
    output: z.string().describe("Combined stdout/stderr stream as captured (may be truncated)"),
    exit_code: z.string().nullable().describe("Exit code reported by Komodo, or null when unknown"),
    truncated: z.boolean().describe("True when the output buffer was truncated by size or timeout"),
    server: z.string().optional().describe("Server context, when the target requires it"),
    container: z.string().optional().describe("Container, when target = container"),
    deployment: z.string().optional().describe("Deployment, when target = deployment"),
    stack: z.string().optional().describe("Stack, when target = stack_service"),
    service: z.string().optional().describe("Service name within the stack, when target = stack_service"),
  })
  .describe("Captured output of a `komodo_exec` invocation");
