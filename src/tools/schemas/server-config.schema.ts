/**
 * Server Configuration Schema
 *
 * Zod schema for Komodo ServerConfig based on official Komodo types.
 * Used for creating and updating server configurations.
 */

import { z } from 'zod';
import { ALERT_DESCRIPTIONS, THRESHOLD_DESCRIPTIONS } from '../../config/descriptions.js';

/**
 * Maintenance Window Schema
 * Defines scheduled maintenance periods during which alerts are suppressed
 */
export const maintenanceWindowSchema = z
  .object({
    enabled: z.boolean().optional().describe('Whether this maintenance window is enabled'),
    name: z.string().optional().describe('Name of the maintenance window'),
    start_ts: z.number().optional().describe('Start timestamp (Unix milliseconds)'),
    end_ts: z.number().optional().describe('End timestamp (Unix milliseconds)'),
    cron: z.string().optional().describe('Cron expression for recurring maintenance windows'),
    duration_hours: z.number().optional().describe('Duration in hours for cron-based windows'),
  })
  .describe('Scheduled maintenance window for alert suppression');

/**
 * Full ServerConfig Schema
 * Matches Komodo's ServerConfig interface
 */
export const serverConfigSchema = z
  .object({
    // Connection Settings
    address: z
      .string()
      .optional()
      .describe(
        'The ws/s address of the periphery client (e.g., http://1.2.3.4:8120). If unset, Server expects Periphery -> Core connection.',
      ),
    insecure_tls: z
      .boolean()
      .optional()
      .describe(
        'Whether to skip Periphery TLS certificate validation. Default: true (Periphery generates self-signed certificates by default)',
      ),
    external_address: z
      .string()
      .optional()
      .describe('The address to use with links for containers on the server. If empty, uses the "address" field'),

    // Server Identification
    region: z.string().optional().describe('An optional region label for the server'),

    // Server State
    enabled: z
      .boolean()
      .optional()
      .describe(
        'Whether the server is enabled. Disabled servers cannot perform actions or show deployment status. Default: false',
      ),

    // Key Management
    auto_rotate_keys: z
      .boolean()
      .optional()
      .describe('Whether to automatically rotate Server keys when RotateAllServerKeys is called. Default: true'),
    passkey: z
      .string()
      .optional()
      .describe(
        '[DEPRECATED] Use private/public keys instead. Optional override passkey for periphery agent authentication',
      ),

    // System Settings
    ignore_mounts: z.array(z.string()).optional().describe('Mount paths to filter out from system stats reports'),
    auto_prune: z
      .boolean()
      .optional()
      .describe('Whether to trigger "docker image prune -a -f" every 24 hours. Default: true'),
    links: z.array(z.string()).optional().describe('Quick links displayed in the resource header'),

    // Monitoring Settings
    stats_monitoring: z
      .boolean()
      .optional()
      .describe('Whether to monitor server stats beyond passing health check. Default: true'),

    // Alert Settings
    send_unreachable_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_UNREACHABLE),
    send_cpu_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_CPU),
    send_mem_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_MEM),
    send_disk_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_DISK),
    send_version_mismatch_alerts: z.boolean().optional().describe(ALERT_DESCRIPTIONS.SEND_VERSION_MISMATCH),

    // Threshold Settings (percentages 0-100)
    cpu_warning: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.CPU_WARNING),
    cpu_critical: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.CPU_CRITICAL),
    mem_warning: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.MEM_WARNING),
    mem_critical: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.MEM_CRITICAL),
    disk_warning: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.DISK_WARNING),
    disk_critical: z.number().min(0).max(100).optional().describe(THRESHOLD_DESCRIPTIONS.DISK_CRITICAL),

    // Maintenance Windows
    maintenance_windows: z
      .array(maintenanceWindowSchema)
      .optional()
      .describe('Scheduled maintenance windows during which alerts will be suppressed'),
  })
  .describe('Configuration for a Komodo server');
