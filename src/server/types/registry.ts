/**
 * Registry Interface Types
 *
 * Generic registry interfaces for tools, resources, and prompts.
 * These interfaces define the contract for extensible registries.
 *
 * @module server/types/registry
 */

import type { z } from 'zod';

// ============================================================================
// Base Registry Types
// ============================================================================

/**
 * Base item interface that all registry items must implement.
 */
export interface IRegistryItem {
  /** Unique name identifying the item */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
}

/**
 * Generic registry interface for any type of registered items.
 *
 * @typeParam T - The type of items stored in the registry
 *
 * @example
 * ```typescript
 * class ToolRegistry implements IRegistry<ITool> {
 *   private tools = new Map<string, ITool>();
 *
 *   register(tool: ITool): void {
 *     this.tools.set(tool.name, tool);
 *   }
 *
 *   get(name: string): ITool | undefined {
 *     return this.tools.get(name);
 *   }
 *
 *   // ... other methods
 * }
 * ```
 */
export interface IRegistry<T extends IRegistryItem> {
  /**
   * Register a new item in the registry.
   *
   * @param item - The item to register
   * @throws If an item with the same name already exists (implementation-dependent)
   */
  register(item: T): void;

  /**
   * Unregister an item by name.
   *
   * @param name - The name of the item to remove
   * @returns true if the item was removed, false if not found
   */
  unregister(name: string): boolean;

  /**
   * Get an item by name.
   *
   * @param name - The name of the item to retrieve
   * @returns The item if found, undefined otherwise
   */
  get(name: string): T | undefined;

  /**
   * Get all registered items.
   *
   * @returns Readonly array of all items
   */
  getAll(): ReadonlyArray<T>;

  /**
   * Check if an item exists in the registry.
   *
   * @param name - The name to check
   * @returns true if the item exists
   */
  has(name: string): boolean;

  /**
   * Get the number of registered items.
   */
  readonly size: number;

  /**
   * Clear all items from the registry.
   */
  clear(): void;
}

// ============================================================================
// Tool Registry Types
// ============================================================================

/**
 * Tool definition interface for MCP tools.
 *
 * @typeParam TArgs - The argument type for the tool
 * @typeParam TResult - The result type for the tool
 */
export interface ITool<TArgs = unknown, TResult = unknown> extends IRegistryItem {
  /** JSON Schema for tool arguments (as Zod schema) */
  readonly schema: z.ZodSchema<TArgs>;

  /**
   * Tool handler function.
   *
   * @param args - Validated arguments
   * @param context - Tool execution context
   * @returns Promise resolving to the tool result
   */
  handler: (args: TArgs, context: unknown) => Promise<TResult>;

  /**
   * Whether this tool requires an API client connection.
   * Tools that don't require a client (like configuration tools) should set this to false.
   *
   * @default true
   */
  readonly requiresClient?: boolean;
}

/**
 * Tool registry specific interface with connection state support.
 */
export interface IToolRegistry<T extends ITool = ITool> extends IRegistry<T> {
  /**
   * Get tools that are currently available based on connection state.
   *
   * @returns Array of tools that can be executed
   */
  getAvailableTools(): ReadonlyArray<T>;

  /**
   * Get tools that require a client connection.
   *
   * @returns Array of tools that need client to be connected
   */
  getClientRequiredTools(): ReadonlyArray<T>;

  /**
   * Get tools that are always available (don't require client).
   *
   * @returns Array of tools available without client
   */
  getAlwaysAvailableTools(): ReadonlyArray<T>;

  /**
   * Set the client connection state.
   *
   * @param connected - Whether a client is connected
   * @returns true if state changed, false if unchanged
   */
  setConnectionState(connected: boolean): boolean;

  /**
   * Get the current connection state.
   */
  getConnectionState(): boolean;
}

// ============================================================================
// Resource Registry Types
// ============================================================================

/**
 * Resource definition interface for MCP resources.
 */
export interface IResource extends IRegistryItem {
  /** Resource URI (e.g., 'myapp://config/main') */
  readonly uri: string;

  /** MIME type of the resource content */
  readonly mimeType?: string;

  /**
   * Resource content provider.
   *
   * @returns Promise resolving to resource content (string or binary)
   */
  read: () => Promise<string | Uint8Array>;
}

/**
 * Resource template for dynamic URIs (RFC 6570).
 */
export interface IResourceTemplate extends IRegistryItem {
  /** URI template pattern (e.g., 'myapp://logs/{logId}') */
  readonly uriTemplate: string;

  /** MIME type of the resource content */
  readonly mimeType?: string;

  /**
   * Template content provider.
   *
   * @param params - Parameters extracted from the URI
   * @returns Promise resolving to resource content
   */
  read: (params: Record<string, string>) => Promise<string | Uint8Array>;
}

/**
 * Resource registry specific interface.
 */
export interface IResourceRegistry extends IRegistry<IResource> {
  /**
   * Register a resource template.
   */
  registerTemplate(template: IResourceTemplate): void;

  /**
   * Get all registered templates.
   */
  getTemplates(): ReadonlyArray<IResourceTemplate>;

  /**
   * Check if any resources or templates are registered.
   */
  hasResources(): boolean;

  /**
   * Get count of resources and templates.
   */
  getCount(): { resources: number; templates: number };
}

// ============================================================================
// Prompt Registry Types
// ============================================================================

/**
 * Prompt argument definition.
 */
export interface IPromptArgument {
  /** Argument name */
  readonly name: string;
  /** Argument description */
  readonly description: string;
  /** Whether the argument is required */
  readonly required?: boolean;
}

/**
 * Prompt message in the generated prompt.
 */
export interface IPromptMessage {
  /** Role: 'user' or 'assistant' */
  readonly role: 'user' | 'assistant';
  /** Message content */
  readonly content: string;
}

/**
 * Prompt definition interface for MCP prompts.
 */
export interface IPrompt extends IRegistryItem {
  /** Arguments that can be passed to the prompt */
  readonly arguments?: ReadonlyArray<IPromptArgument>;

  /**
   * Generate prompt messages.
   *
   * @param args - Arguments passed to the prompt
   * @returns Promise resolving to array of messages
   */
  generate: (args: Record<string, unknown>) => Promise<ReadonlyArray<IPromptMessage>>;
}

/**
 * Prompt registry specific interface.
 */
export interface IPromptRegistry extends IRegistry<IPrompt> {
  /**
   * Check if any prompts are registered.
   */
  hasPrompts(): boolean;

  /**
   * Get count of registered prompts.
   */
  getCount(): number;
}
