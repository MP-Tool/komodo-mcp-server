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
import { PARAM_DESCRIPTIONS, VALIDATION_LIMITS } from "../../config/index.js";
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
 * Discriminated union schema for `komodo_exec`.
 *
 * Discriminator: `target` — selects one of four execution contexts.
 * Each variant carries the fields required by that context.
 */
export const execInputSchema = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("server").describe("Execute on a Komodo server (host shell via Periphery terminal)."),
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    command: execCommandSchema.describe("The shell command to execute on the server"),
    terminal: execTerminalNameSchema,
  }),
  z.object({
    target: z.literal("container").describe("Execute inside a running Docker container (like `docker exec`)."),
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
    command: execCommandSchema.describe("The command to execute inside the container"),
    shell: execShellSchema,
  }),
  z.object({
    target: z.literal("deployment").describe("Execute inside the container of a Komodo deployment."),
    deployment: deploymentIdSchema.describe("Deployment ID or name to execute the command in"),
    command: execCommandSchema.describe("The command to execute inside the deployment container"),
    shell: execShellSchema,
  }),
  z.object({
    target: z.literal("stack_service").describe("Execute inside a specific service container of a Komodo stack."),
    stack: stackIdSchema.describe("Stack ID or name"),
    service: execServiceNameSchema,
    command: execCommandSchema.describe("The command to execute inside the service container"),
    shell: execShellSchema,
  }),
]);
