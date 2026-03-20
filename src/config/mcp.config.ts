/**
 * MCP Configuration Aggregator
 *
 * Aggregates all MCP module configurations into a single unified config.
 * This provides a central access point for all MCP-related settings.
 *
 * Architecture:
 * - Each MCP module (prompts, resources, tools) has its own local config
 * - Local configs are "low-level" and can be imported directly when needed
 * - This aggregator combines them for server-wide access
 *
 * @module config/mcp
 *
 * @example
 * ```typescript
 * // Import the full aggregated config
 * import { MCP_CONFIG } from './config/mcp.config.js';
 * console.log(MCP_CONFIG.tools.categories); // ['config', 'container', ...]
 *
 * // Or import individual module configs
 * import { PROMPT_CONFIG } from '../mcp/prompts/config/index.js';
 * import { RESOURCE_CONFIG } from '../mcp/resources/config/index.js';
 * import { TOOL_CONFIG } from '../mcp/tools/tools.config.js';
 * ```
 */

// Import local MCP module configurations
import { PROMPT_CONFIG, type PromptConfig, type PromptCategory } from '../mcp/prompts/config/index.js';
import { RESOURCE_CONFIG, type ResourceConfig, type ResourceCategory } from '../mcp/resources/config/index.js';
import { TOOL_CONFIG, type ToolConfig, type ToolCategory } from '../mcp/tools/tools.config.js';

// ============================================================================
// Re-export local configs for direct access
// ============================================================================

export { PROMPT_CONFIG, RESOURCE_CONFIG, TOOL_CONFIG };

// Re-export types
export type { PromptConfig, ResourceConfig, ToolConfig };

// Re-export category types
export type { PromptCategory, ResourceCategory, ToolCategory };

// ============================================================================
// Aggregated MCP Configuration
// ============================================================================

/**
 * Type definition for the aggregated MCP configuration
 */
export interface McpConfig {
  /** Prompt module configuration */
  prompts: PromptConfig;
  /** Resource module configuration */
  resources: ResourceConfig;
  /** Tool module configuration */
  tools: ToolConfig;
}

/**
 * Aggregated MCP configuration object.
 *
 * Combines all MCP module configurations for centralized access.
 * Use this when you need access to multiple module configs.
 *
 * @example
 * ```typescript
 * import { MCP_CONFIG } from './config/mcp.config.js';
 *
 * // Access tool categories
 * const toolCategories = MCP_CONFIG.tools.categories;
 *
 * // Access resource defaults
 * const jsonMimeType = MCP_CONFIG.resources.defaults.JSON_MIME_TYPE;
 *
 * // Access prompt metadata
 * const promptVersion = MCP_CONFIG.prompts.metadata.VERSION;
 * ```
 */
export const MCP_CONFIG: McpConfig = {
  prompts: PROMPT_CONFIG,
  resources: RESOURCE_CONFIG,
  tools: TOOL_CONFIG,
} as const;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get all MCP module versions
 *
 * @returns Object with version strings for each module
 */
export function getMcpVersions(): Record<string, string> {
  return {
    prompts: MCP_CONFIG.prompts.metadata.VERSION,
    resources: MCP_CONFIG.resources.metadata.VERSION,
    tools: MCP_CONFIG.tools.metadata.VERSION,
  };
}

/**
 * Get all available categories across all MCP modules
 *
 * @returns Object with category arrays for each module
 */
export function getAllCategories(): {
  prompts: readonly string[];
  resources: readonly string[];
  tools: readonly string[];
} {
  return {
    prompts: MCP_CONFIG.prompts.categories,
    resources: MCP_CONFIG.resources.categories,
    tools: MCP_CONFIG.tools.categories,
  };
}
