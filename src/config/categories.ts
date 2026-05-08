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
  CONTAINER: "container",
  STACK: "stack",
  DEPLOYMENT: "deployment",
  SERVER: "server",
  TERMINAL: "terminal",
  USER: "user",
  CONFIG: "config",
} as const;

export type ToolCategory = (typeof ToolCategories)[keyof typeof ToolCategories];
