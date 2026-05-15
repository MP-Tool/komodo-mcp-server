/**
 * Server Schemas
 *
 * Zod schemas for server configuration including alerts, thresholds,
 * and maintenance windows.
 *
 * @module tools/schemas/server
 */

import { z } from "mcp-server-framework";
import { Types } from "komodo_client";
import { ALERT_DESCRIPTIONS, THRESHOLD_DESCRIPTIONS, CONFIG_DESCRIPTIONS } from "../../config/index.js";
import { serverIdSchema, resourceNameSchema } from "./validators.js";
import { actionResultSchema, resourceLinkSchema, pageOutputSchema } from "./shared.js";

/** Scheduled maintenance window for alert suppression */
const maintenanceWindowSchema = z
  .object({
    name: z.string().describe("Name of the maintenance window"),
    description: z.string().optional().describe("Description of what maintenance is performed"),
    schedule_type: z
      .nativeEnum(Types.MaintenanceScheduleType)
      .optional()
      .describe("Schedule type: Daily, Weekly, or OneTime"),
    day_of_week: z.string().optional().describe("For Weekly schedules: day of the week"),
    date: z.string().optional().describe("For OneTime: ISO 8601 date format (YYYY-MM-DD)"),
    hour: z.number().int().min(0).max(23).optional().describe("Start hour in 24-hour format (0-23)"),
    minute: z.number().int().min(0).max(59).optional().describe("Start minute (0-59)"),
    duration_minutes: z.number().describe("Duration of the maintenance window in minutes"),
    timezone: z.string().optional().describe("Timezone for maintenance window"),
    enabled: z.boolean().describe("Whether this maintenance window is currently enabled"),
  })
  .describe("Scheduled maintenance window for alert suppression");

/** Server configuration — all fields optional (partial by design) */
export const serverConfigSchema = z
  .object({
    address: z.string().optional().describe("The ws/s address of the periphery client (e.g., http://1.2.3.4:8120)"),
    insecure_tls: z
      .boolean()
      .optional()
      .describe("Whether to skip Periphery TLS certificate validation. Default: true"),
    external_address: z.string().optional().describe("The address to use with links for containers on the server"),
    region: z.string().optional().describe("An optional region label for the server"),
    enabled: z.boolean().optional().describe("Whether the server is enabled. Default: false"),
    auto_rotate_keys: z.boolean().optional().describe("Whether to automatically rotate Server keys. Default: true"),
    passkey: z.string().optional().describe("[DEPRECATED] Use private/public keys instead."),
    ignore_mounts: z.array(z.string()).optional().describe("Mount paths to filter out from system stats"),
    auto_prune: z.boolean().optional().describe('Trigger "docker image prune -a -f" every 24 hours. Default: true'),
    links: z.array(z.string()).optional().describe("Quick links displayed in the resource header"),
    stats_monitoring: z.boolean().optional().describe("Monitor server stats beyond health check. Default: true"),
    send_unreachable_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_UNREACHABLE),
    send_cpu_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_CPU),
    send_mem_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_MEM),
    send_disk_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_DISK),
    send_version_mismatch_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_VERSION_MISMATCH),
    cpu_warning: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.CPU_WARNING),
    cpu_critical: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.CPU_CRITICAL),
    mem_warning: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.MEM_WARNING),
    mem_critical: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.MEM_CRITICAL),
    disk_warning: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.DISK_WARNING),
    disk_critical: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.DISK_CRITICAL),
    maintenance_windows: z.array(maintenanceWindowSchema).optional().describe("Scheduled maintenance windows"),
  })
  .describe("Configuration for a Komodo server");

/**
 * Discriminated input for `komodo_server_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Server (`name` required)
 * - `action: "update"` — PATCH-style update of an existing Server (`server` required)
 */
/**
 * Input for `komodo_server_apply` (create-or-update).
 *
 * Flat schema (instead of `z.discriminatedUnion`) so MCP Inspector and other UI
 * clients can render the form. The handler validates that `name` is present
 * when `action='create'` and `server` is present when `action='update'`.
 */
export const serverApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' to register a new server, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new server"),
  server: serverIdSchema.optional().describe("Required when action='update' — existing server id or name"),
  config: serverConfigSchema.optional().describe(CONFIG_DESCRIPTIONS.SERVER_CONFIG_PARTIAL),
});

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single server as returned in list/info responses. */
export const serverSummarySchema = z.object({
  id: z.string().describe("Server ID"),
  name: z.string().describe("Server name"),
  state: z.string().optional().describe("Server state (Ok, NotOk, Disabled, ...) when known"),
  version: z.string().optional().describe("Periphery agent version"),
  region: z.string().optional().describe("Optional region label"),
});

/** Output of `komodo_server_list`. */
export const serverListOutputSchema = z
  .object({
    items: z.array(serverSummarySchema).describe("Servers registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered servers");

/** Output of `komodo_server_info`. */
export const serverInfoOutputSchema = z
  .object({
    summary: serverSummarySchema,
    info: z.unknown().optional().describe("Full server resource payload, when returned inline"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Detailed information about a server");

/** Output of `komodo_server_stats`. */
export const serverStatsOutputSchema = z
  .object({
    server: z.string().describe("Server ID"),
    status: z.string().describe("Health status reported by Periphery"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Server health and status snapshot");

// ============================================================================
// Server Action (host-level operations)
// ============================================================================

/**
 * Discriminator for `komodo_server_action`.
 *
 * Groups host-level operations on a Komodo server resource:
 * - Batch container ops: start/restart/pause/unpause/stop *all* containers on the host
 * - Prune ops: free disk space by removing unused Docker resources
 * - Delete ops: remove a specific named network/image/volume (requires `name`)
 */
export const serverActionEnum = z.enum([
  "start_all_containers",
  "restart_all_containers",
  "pause_all_containers",
  "unpause_all_containers",
  "stop_all_containers",
  "prune_containers",
  "prune_images",
  "prune_volumes",
  "prune_networks",
  "prune_system",
  "prune_docker_builders",
  "prune_buildx",
  "delete_network",
  "delete_image",
  "delete_volume",
]);
export type ServerAction = z.infer<typeof serverActionEnum>;

/**
 * Flat input schema for `komodo_server_action`.
 *
 * Uses a flat shape (not `z.discriminatedUnion`) for MCP-Inspector compatibility.
 * Per-action required fields are validated at runtime in the handler.
 */
export const serverActionInputSchema = z.object({
  action: serverActionEnum.describe(
    "Action to perform. Batch container ops act on every container on the host. Prune ops free disk space. Delete ops require `name`.",
  ),
  server: serverIdSchema.describe("Target server (id or name)"),
  name: z
    .string()
    .min(1)
    .optional()
    .describe("Required for delete_network/delete_image/delete_volume. Name of the resource to delete."),
});

export const serverActionOutputSchema = actionResultSchema;
