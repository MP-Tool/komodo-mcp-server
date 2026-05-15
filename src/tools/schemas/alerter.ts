/**
 * Alerter Schemas
 *
 * Zod schemas for Komodo Alerter resources (`komodo_alerter_*` tools).
 *
 * @module tools/schemas/alerter
 */

import { z } from "mcp-server-framework";
import { resourceNameSchema } from "./validators.js";
import { pageOutputSchema, resourceLinkSchema, maintenanceWindowSchema } from "./shared.js";

/** Alerter identifier (id or name) accepted by the Komodo API. */
export const alerterIdSchema = z.string().min(1);

/** Compact summary of a single alerter. */
export const alerterSummarySchema = z.object({
  id: z.string().describe("Alerter ID"),
  name: z.string().describe("Alerter name"),
  enabled: z.boolean().optional().describe("Whether the alerter is currently enabled"),
  endpoint_type: z.string().optional().describe("Endpoint type (Slack, Discord, Custom, ...)"),
});

/** Output of `komodo_alerter_list`. */
export const alerterListOutputSchema = z
  .object({
    items: z.array(alerterSummarySchema).describe("Alerters registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered alerters");

/** Output of `komodo_alerter_info`. */
export const alerterInfoOutputSchema = z
  .object({
    summary: alerterSummarySchema,
    info: z.unknown().optional().describe("Full Alerter resource (only when not offloaded as a resource link)"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Alerter summary + optional full resource");

// ============================================================================
// Input Schemas — CRUD
// ============================================================================

/**
 * Alerter endpoint (discriminated by `type`).
 *
 * The Komodo SDK declares many variants (Slack, Discord, Custom, Ntfy, ...) each
 * with their own provider-specific fields. We accept an open record keyed by
 * `type` so the client surface stays compact and the Komodo backend performs
 * the final shape validation.
 */
export const alerterEndpointSchema = z
  .object({
    type: z.string().describe("Endpoint variant — 'Custom', 'Slack', 'Discord', 'Ntfy', 'Pushover', ..."),
    params: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Provider-specific endpoint parameters (URL, token, channel, ...)"),
  })
  .describe("Where to route alerts — see Komodo `AlerterEndpoint` discriminated union");

/** Alerter configuration — all fields optional (PATCH-style). Mirrors `Types.AlerterConfig`. */
export const alerterConfigSchema = z
  .object({
    enabled: z.boolean().optional().describe("Whether the alerter is enabled"),
    endpoint: alerterEndpointSchema.optional().describe("Where to route alert messages"),
    alert_types: z
      .array(z.string())
      .optional()
      .describe("Only send these alert types (empty = all). E.g. 'ServerUnreachable', 'ContainerStateChange', ..."),
    resources: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("Only send alerts for these resources (`ResourceTarget` shape). Empty = all resources."),
    except_resources: z
      .array(z.record(z.string(), z.unknown()))
      .optional()
      .describe("Suppress alerts for these resources (`ResourceTarget` shape)"),
    maintenance_windows: z
      .array(maintenanceWindowSchema)
      .optional()
      .describe("Scheduled maintenance windows during which alerts are suppressed"),
  })
  .describe("Alerter configuration — only specify fields you want to set or update");

/**
 * Input for `komodo_alerter_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `alerter` for update at runtime.
 */
export const alerterApplyInputSchema = z.object({
  action: z
    .enum(["create", "update"])
    .describe("'create' to register a new alerter, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new alerter"),
  alerter: alerterIdSchema.optional().describe("Required when action='update' — existing alerter id or name"),
  config: alerterConfigSchema.optional().describe("Alerter configuration (PATCH-style)"),
});
