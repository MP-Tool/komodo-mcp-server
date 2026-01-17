/**
 * Komodo MCP Registry Adapters
 *
 * Adapts the existing Komodo-specific registries (toolRegistry, resourceRegistry, promptRegistry)
 * to the framework's provider interfaces (IToolProvider, IResourceProvider, IPromptProvider).
 *
 * This enables using the existing registry pattern with the new McpServerBuilder.
 *
 * @module app/adapters
 */

import type { KomodoClient } from './api/index.js';
import type {
  IToolProvider,
  IToolDefinition,
  IResourceProvider,
  IResourceDefinition,
  IResourceTemplateDefinition,
  IPromptProvider,
  IPromptDefinition,
} from './framework.js';

import { toolRegistry } from './mcp/tools/index.js';
import { resourceRegistry } from './mcp/resources/index.js';
import { promptRegistry } from './mcp/prompts/index.js';

// ============================================================================
// Tool Registry Adapter
// ============================================================================

/**
 * Adapts the Komodo ToolRegistry to IToolProvider interface.
 *
 * This adapter wraps the existing toolRegistry singleton to make it
 * compatible with the McpServerBuilder's provider pattern.
 *
 * @example
 * ```typescript
 * const server = new McpServerBuilder<KomodoClient>()
 *   .withToolProvider(toolRegistryAdapter)
 *   .build();
 * ```
 */
class ToolRegistryAdapter implements IToolProvider<KomodoClient> {
  /**
   * Get all tools from the registry.
   */
  getTools(): ReadonlyArray<IToolDefinition<unknown, KomodoClient>> {
    return toolRegistry.getTools() as ReadonlyArray<IToolDefinition<unknown, KomodoClient>>;
  }

  /**
   * Get tools available when client is connected.
   */
  getAvailableTools(): ReadonlyArray<IToolDefinition<unknown, KomodoClient>> {
    return toolRegistry.getAvailableTools() as ReadonlyArray<IToolDefinition<unknown, KomodoClient>>;
  }

  /**
   * Set the connection state (delegates to toolRegistry).
   */
  setConnectionState(connected: boolean): void {
    toolRegistry.setConnectionState(connected);
  }
}

/** Singleton adapter instance for tool registry */
export const toolRegistryAdapter = new ToolRegistryAdapter();

// ============================================================================
// Resource Registry Adapter
// ============================================================================

/**
 * Adapts the Komodo ResourceRegistry to IResourceProvider interface.
 *
 * @example
 * ```typescript
 * const server = new McpServerBuilder<KomodoClient>()
 *   .withResourceProvider(resourceRegistryAdapter)
 *   .build();
 * ```
 */
class ResourceRegistryAdapter implements IResourceProvider {
  /**
   * Get all static resources from the registry.
   */
  getResources(): ReadonlyArray<IResourceDefinition> {
    return resourceRegistry.getResources() as unknown as ReadonlyArray<IResourceDefinition>;
  }

  /**
   * Get all resource templates from the registry.
   */
  getTemplates(): ReadonlyArray<IResourceTemplateDefinition> {
    return resourceRegistry.getTemplates() as unknown as ReadonlyArray<IResourceTemplateDefinition>;
  }

  /**
   * Check if provider has any resources.
   */
  hasResources(): boolean {
    return resourceRegistry.hasResources();
  }
}

/** Singleton adapter instance for resource registry */
export const resourceRegistryAdapter = new ResourceRegistryAdapter();

// ============================================================================
// Prompt Registry Adapter
// ============================================================================

/**
 * Adapts the Komodo PromptRegistry to IPromptProvider interface.
 *
 * @example
 * ```typescript
 * const server = new McpServerBuilder<KomodoClient>()
 *   .withPromptProvider(promptRegistryAdapter)
 *   .build();
 * ```
 */
class PromptRegistryAdapter implements IPromptProvider {
  /**
   * Get all prompts from the registry.
   */
  getPrompts(): ReadonlyArray<IPromptDefinition> {
    return promptRegistry.getPrompts() as unknown as ReadonlyArray<IPromptDefinition>;
  }

  /**
   * Check if provider has any prompts.
   */
  hasPrompts(): boolean {
    return promptRegistry.hasPrompts();
  }
}

/** Singleton adapter instance for prompt registry */
export const promptRegistryAdapter = new PromptRegistryAdapter();
