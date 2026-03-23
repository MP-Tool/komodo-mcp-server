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
import { ALERT_DESCRIPTIONS, THRESHOLD_DESCRIPTIONS } from "../../config/index.js";

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
