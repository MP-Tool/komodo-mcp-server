/**
 * Tool Configuration (Local)
 *
 * Local configuration for MCP Tools module.
 * Contains tool categories, metadata, and module-specific settings.
 *
 * Note: Tool defaults (like CONTAINER_LOGS_DEFAULTS) remain in `src/config/tools.config.ts`
 * as they are used across the application. This file contains module-level metadata.
 *
 * This configuration is aggregated into the global MCP config at `src/config/mcp.config.ts`.
 *
 * @module mcp/tools/config
 */

// ============================================================================
// Tool Categories
// ============================================================================

/**
 * Available tool categories.
 * Used for organizing and filtering tools.
 */
// prettier-ignore
export const TOOL_CATEGORIES = [
  'config',
  'container',
  'server',
  'stack',
  'deployment',
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

/**
 * Tool category descriptions for documentation
 */
export const TOOL_CATEGORY_DESCRIPTIONS: Record<ToolCategory, string> = {
  config: 'Configuration and health check tools',
  container: 'Docker container management tools',
  server: 'Komodo server management tools',
  stack: 'Docker Compose stack management tools',
  deployment: 'Komodo deployment management tools',
} as const;

// ============================================================================
// Tool Naming Convention
// ============================================================================

/**
 * Tool naming configuration.
 * All tools follow the pattern: `komodo_<action>` or `komodo_<domain>_<action>`
 */
export const TOOL_NAMING = {
  /** Prefix for all Komodo tools */
  PREFIX: 'komodo',
  /** Separator between prefix and name parts */
  SEPARATOR: '_',
} as const;

// ============================================================================
// Tool Metadata
// ============================================================================

/**
 * Metadata about the tools module
 */
export const TOOL_METADATA = {
  /** Version of the tool implementation */
  VERSION: '1.0.0',
  /** Total number of tool categories */
  CATEGORY_COUNT: TOOL_CATEGORIES.length,
} as const;

// ============================================================================
// Tool Capability Flags
// ============================================================================

/**
 * Tool capability configuration.
 * Defines what features are available for tools.
 */
export const TOOL_CAPABILITIES = {
  /** Whether tools support progress reporting */
  PROGRESS_REPORTING: true,
  /** Whether tools support cancellation via AbortSignal */
  CANCELLATION: true,
  /** Whether tools can dynamically change based on connection state */
  DYNAMIC_AVAILABILITY: true,
} as const;

// ============================================================================
// Aggregated Export
// ============================================================================

/**
 * Complete tool configuration object.
 * Used by the global MCP config aggregator.
 */
export const TOOL_CONFIG = {
  categories: TOOL_CATEGORIES,
  categoryDescriptions: TOOL_CATEGORY_DESCRIPTIONS,
  naming: TOOL_NAMING,
  metadata: TOOL_METADATA,
  capabilities: TOOL_CAPABILITIES,
} as const;

export type ToolConfig = typeof TOOL_CONFIG;
