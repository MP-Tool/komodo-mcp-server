/**
 * Swarm Schemas
 *
 * Zod schemas for Komodo Swarm resources (`komodo_swarm_*` tools).
 *
 * Komodo v2 introduces Swarms — a higher-level orchestration resource that
 * groups Docker Swarm manager servers, exposing per-node and per-service
 * operations on top of the underlying cluster.
 *
 * @module tools/schemas/swarm
 */

import { z } from "mcp-server-framework";
import { resourceNameSchema } from "./validators.js";
import { actionResultSchema, maintenanceWindowSchema, pageOutputSchema, resourceLinkSchema } from "./shared.js";

/** Swarm identifier (id or name) accepted by the Komodo API. */
export const swarmIdSchema = z.string().min(1);

// ============================================================================
// Output Schemas
// ============================================================================

/** Compact summary of a single swarm as returned in list/info responses. */
export const swarmSummarySchema = z.object({
  id: z.string().describe("Swarm ID"),
  name: z.string().describe("Swarm name"),
  state: z.string().optional().describe("Swarm state (Ok, Unhealthy, Unknown, ...) when known"),
  server_ids: z.array(z.string()).optional().describe("IDs of the manager Servers participating in the swarm"),
  err: z.string().optional().describe("Error reaching the swarm, if any"),
});

/** Output of `komodo_swarm_list`. */
export const swarmListOutputSchema = z
  .object({
    items: z.array(swarmSummarySchema).describe("Swarms registered in Komodo"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of registered swarms");

/** Output of `komodo_swarm_info`. */
export const swarmInfoOutputSchema = z
  .object({
    summary: swarmSummarySchema,
    info: z.unknown().optional().describe("Full Swarm resource (only when not offloaded as a resource link)"),
    resourceLink: resourceLinkSchema.optional(),
  })
  .describe("Swarm summary + optional full resource");

/** Output of `komodo_swarm_action` (long-running action result). */
export const swarmActionOutputSchema = actionResultSchema;

/** Compact summary of a single Swarm node. */
export const swarmNodeSummarySchema = z.object({
  id: z.string().optional().describe("Node ID"),
  name: z.string().optional().describe("Node name"),
  hostname: z.string().optional().describe("Node hostname"),
  role: z.string().optional().describe("Node role (manager / worker)"),
  availability: z.string().optional().describe("Node availability (active / pause / drain)"),
  state: z.string().optional().describe("Node state (ready / down / unknown)"),
});

/** Output of `komodo_swarm_nodes_list`. */
export const swarmNodesListOutputSchema = z
  .object({
    swarm: z.string().describe("Swarm id or name the nodes belong to"),
    items: z.array(swarmNodeSummarySchema).describe("Nodes participating in the swarm"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of swarm nodes");

/** Compact summary of a single Swarm service. */
export const swarmServiceSummarySchema = z.object({
  id: z.string().optional().describe("Service ID"),
  name: z.string().optional().describe("Service name"),
  image: z.string().optional().describe("Service image"),
  mode: z.string().optional().describe("Service mode (replicated / global)"),
  replicas: z.number().int().optional().describe("Number of replicas (for replicated services)"),
});

/** Output of `komodo_swarm_services_list`. */
export const swarmServicesListOutputSchema = z
  .object({
    swarm: z.string().describe("Swarm id or name the services belong to"),
    items: z.array(swarmServiceSummarySchema).describe("Services running on the swarm"),
    page: pageOutputSchema.optional(),
  })
  .describe("List of swarm services");

// ============================================================================
// Config / Action Inputs
// ============================================================================

/**
 * Partial Swarm configuration. Mirrors `Types.SwarmConfig` field-for-field.
 *
 * The Swarm config is small enough to be expressed exactly:
 * - `server_ids`: manager Servers participating in the swarm
 * - `links`: quick-access links shown in the resource header
 * - `send_unhealthy_alerts`: emit alerts when swarm health degrades
 * - `maintenance_windows`: scheduled windows during which alerts are suppressed
 */
export const swarmConfigSchema = z
  .object({
    server_ids: z
      .array(z.string())
      .optional()
      .describe("Komodo Server ids/names that act as manager nodes for the swarm"),
    links: z.array(z.string()).optional().describe("Quick links displayed in the resource header"),
    send_unhealthy_alerts: z.boolean().optional().describe("Whether to send alerts about swarm health"),
    maintenance_windows: z
      .array(maintenanceWindowSchema)
      .optional()
      .describe("Scheduled maintenance windows during which alerts will be suppressed"),
  })
  .describe("Partial Swarm configuration (all fields optional)");

/**
 * Swarm action discriminator.
 *
 * Each action targets a different Komodo `execute` endpoint and requires
 * different additional parameters — see `swarmActionInputSchema`.
 */
export const swarmActionEnum = z.enum(["update_node", "remove_nodes", "remove_services", "remove_stacks"]);

/**
 * Flat input schema for `komodo_swarm_action` (single object, action enum).
 *
 * Replaces `z.discriminatedUnion` because many MCP clients (incl. MCP Inspector)
 * cannot render discriminated unions as input forms. The handler validates the
 * per-action required fields at runtime via `AppErrorFactory.validation.fieldRequired`.
 *
 * - `update_node`     → `UpdateSwarmNode`     (requires `node`)
 * - `remove_nodes`    → `RemoveSwarmNodes`    (requires `nodes`)
 * - `remove_services` → `RemoveSwarmServices` (requires `services`)
 * - `remove_stacks`   → `RemoveSwarmStacks`   (requires `stacks`)
 */
export const swarmActionInputSchema = z.object({
  action: swarmActionEnum.describe("Swarm action: update_node | remove_nodes | remove_services | remove_stacks"),
  swarm: swarmIdSchema.describe("Swarm id or name"),
  // update_node
  node: z.string().min(1).optional().describe("Required for 'update_node': node hostname or id"),
  availability: z.enum(["active", "pause", "drain"]).optional().describe("For 'update_node': new node availability"),
  label_add: z.array(z.string()).optional().describe("For 'update_node': labels to add (`key=value`)"),
  label_rm: z.array(z.string()).optional().describe("For 'update_node': label keys to remove"),
  role: z.enum(["worker", "manager"]).optional().describe("For 'update_node': new node role"),
  // remove_nodes
  nodes: z.array(z.string().min(1)).optional().describe("Required for 'remove_nodes': node names/ids to remove"),
  force: z.boolean().optional().describe("For 'remove_nodes': force-remove the node"),
  // remove_services
  services: z
    .array(z.string().min(1))
    .optional()
    .describe("Required for 'remove_services': service names/ids to remove"),
  // remove_stacks
  stacks: z.array(z.string().min(1)).optional().describe("Required for 'remove_stacks': stack names to remove"),
  detach: z.boolean().optional().describe("For 'remove_stacks': do not wait for removal to complete"),
});

/**
 * Discriminated input for `komodo_swarm_apply` (create-or-update).
 *
 * - `action: "create"` — register a new Swarm (`name` required, `config.server_ids` recommended)
 * - `action: "update"` — PATCH-style update of an existing Swarm (`swarm` required)
 */
/**
 * Input for `komodo_swarm_apply` (create-or-update).
 *
 * Flat schema so MCP Inspector renders the form. The handler enforces
 * `name` for create and `swarm` for update at runtime.
 */
export const swarmApplyInputSchema = z.object({
  action: z.enum(["create", "update"]).describe("'create' to register a new swarm, 'update' to PATCH an existing one"),
  name: resourceNameSchema.optional().describe("Required when action='create' — unique name for the new swarm"),
  swarm: swarmIdSchema.optional().describe("Required when action='update' — existing swarm id or name"),
  config: swarmConfigSchema.optional().describe("Swarm configuration (all fields optional, PATCH-style)"),
});
