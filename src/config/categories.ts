/**
 * Tool Categories
 *
 * Forward-compatible category metadata attached to every tool via
 * `_meta.category`. The MCP-Server-Framework can use this for categorization,
 * filtering, or other metadata-driven behavior. Categories are not enforced
 * or interpreted by the framework — they are opaque strings that can be used
 * as needed by the server implementation or client applications.
 *
 * @module config/categories
 */

export const ToolCategories = {
  CONFIG: "config",
  SERVER: "server",
  SWARM: "swarm",
  CONTAINER: "container",
  TERMINAL: "terminal",
  STACK: "stack",
  DEPLOYMENT: "deployment",
  BUILD: "build",
  REPO: "repo",
  PROCEDURE: "procedure",
  ACTION: "action",
  ALERTER: "alerter",
  USER: "user",
  VARIABLE: "variable",
  RESOURCE_SYNC: "resource_sync",
  UPDATE: "update",
} as const;

export type ToolCategory = (typeof ToolCategories)[keyof typeof ToolCategories];
