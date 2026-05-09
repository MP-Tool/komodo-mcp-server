/**
 * Shared Subschemas
 *
 * Cross-domain Zod subschemas reused across multiple tool domains.
 *
 * @module tools/schemas/shared
 */

import { z } from "mcp-server-framework";

/** Cursor-based pagination input for list tools. */
export const paginationInputSchema = z.object({
  cursor: z
    .string()
    .optional()
    .describe("Opaque pagination cursor returned by a previous list call. Omit for the first page."),
  page_size: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe("Maximum number of items to return (1-100). Default: server-defined."),
});

/**
 * Inline-full toggle for detail tools.
 *
 * When `true`, the tool returns the full payload inline instead of a
 * compact summary. When `false` (default), a concise summary is returned.
 */
export const inlineFullInputSchema = z.object({
  inline_full: z
    .boolean()
    .optional()
    .describe("If true, return the full payload inline instead of a compact summary. Default: false."),
});

/** System command configuration (working directory + shell command). */
export const systemCommandSchema = z
  .object({
    path: z.string().optional().describe("Working directory for the command"),
    command: z.string().optional().describe("The shell command to execute"),
  })
  .describe("System command configuration");

/** Git source configuration: linked Komodo Repo or direct git provider settings. */
export const linkedRepoSchema = z.object({
  linked_repo: z.string().optional().describe("Komodo Repo resource name/ID to source files from"),
  git_provider: z.string().optional().describe('Git provider domain. Default: "github.com"'),
  git_https: z.boolean().optional().describe("Use HTTPS for git clone. Default: true"),
  git_account: z.string().optional().describe("Git account name for private repo access"),
  repo: z.string().optional().describe("Repository path: {namespace}/{repo_name}"),
  branch: z.string().optional().describe('Git branch to use. Default: "main"'),
  commit: z.string().optional().describe("Specific commit hash to checkout"),
  clone_path: z.string().optional().describe("Custom path for cloning the repository"),
  reclone: z.boolean().optional().describe("Delete and reclone instead of git pull"),
});

/** Incoming-webhook configuration for triggering deployments from git events. */
export const webhookSchema = z.object({
  webhook_enabled: z.boolean().optional().describe("Enable incoming webhooks to trigger deployments"),
  webhook_secret: z.string().optional().describe("Custom webhook secret (empty = use default)"),
  webhook_force_deploy: z.boolean().optional().describe("Force deploy on webhook"),
});

/**
 * MCP `ResourceLink` content envelope.
 *
 * Compact reference to a resource exposed by the server, allowing detail
 * tools to point at large payloads without inlining them.
 */
export const resourceLinkSchema = z
  .object({
    uri: z.string().describe("Resource URI (e.g. komodo://server/{id})"),
    name: z.string().describe("Human-readable resource name"),
    mimeType: z.string().optional().describe("MIME type of the linked resource"),
    description: z.string().optional().describe("Short description of the linked resource"),
  })
  .describe("Reference to a server-exposed resource");

/** Cursor-based page envelope for list responses. */
export const pageOutputSchema = z
  .object({
    next_cursor: z.string().optional().describe("Pagination cursor for the next page. Absent if no further results."),
    total: z.number().int().optional().describe("Total number of items across all pages, when known."),
  })
  .describe("Pagination envelope for list responses");

/**
 * Common result envelope for lifecycle / action / prune tools.
 *
 * Captures the outcome of a Komodo `execute` call after polling completes:
 * which action ran, against which resource, whether it succeeded, and the
 * underlying update status string.
 */
export const actionResultSchema = z
  .object({
    success: z.boolean().describe("Whether the action completed successfully"),
    status: z.string().describe("Update status reported by Komodo (Complete, InProgress, Queued, ...)"),
    action: z.string().describe("Action name that was executed (start, stop, deploy, prune, ...)"),
    resource_type: z.string().describe("Target resource type (container, deployment, stack, server)"),
    resource_id: z.string().describe("Target resource ID or name"),
    server: z.string().optional().describe("Target server, when the action runs against a host"),
    version: z.string().optional().describe("Resulting version string, when the action produces one (e.g. deploy)"),
  })
  .describe("Outcome envelope returned by lifecycle / action / prune tools");
