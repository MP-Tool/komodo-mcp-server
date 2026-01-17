/**
 * Server Builder Types
 *
 * Type definitions for the declarative MCP server builder pattern.
 * These types define the contract between the framework and application layers.
 *
 * @module server/builder/types
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import type { IApiClient } from '../types/client.js';
import type { IServerOptions, IServerInstance } from '../types/server-options.js';
import type { IToolContext } from '../types/tool-context.js';
import type { z } from 'zod';

// Re-export SDK types for convenience
export type { CallToolResult };

// ============================================================================
// Tool Registration Types
// ============================================================================

/**
 * Tool definition for server builder registration.
 *
 * This interface represents a tool that can be registered with the server builder.
 * It's a simplified version of the full Tool interface used in registries.
 *
 * @typeParam TArgs - The argument type for the tool
 * @typeParam TClient - The API client type
 */
export interface IToolDefinition<TArgs = unknown, TClient extends IApiClient = IApiClient> {
  /** Unique tool name (e.g., 'komodo_list_servers') */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Zod schema for argument validation */
  readonly schema: z.ZodSchema<TArgs>;
  /** Whether client connection is required (default: true) */
  readonly requiresClient?: boolean;
  /** Tool handler function - must return SDK CallToolResult */
  handler: (args: TArgs, context: IToolContext<TClient>) => Promise<CallToolResult>;
}

/**
 * Tool provider interface for custom tool registration.
 *
 * Implement this interface to provide tools from external sources
 * (e.g., plugin systems, dynamic loading).
 */
export interface IToolProvider<TClient extends IApiClient = IApiClient> {
  /** Get all tools from this provider */
  getTools(): ReadonlyArray<IToolDefinition<unknown, TClient>>;

  /** Get tools available when client is connected */
  getAvailableTools(): ReadonlyArray<IToolDefinition<unknown, TClient>>;

  /** Set the connection state */
  setConnectionState(connected: boolean): void;
}

// ============================================================================
// Resource Registration Types
// ============================================================================

/**
 * Resource content type for text resources.
 */
export interface ITextResourceContent {
  readonly uri: string;
  readonly mimeType?: string;
  readonly text: string;
}

/**
 * Resource content type for binary resources.
 */
export interface IBlobResourceContent {
  readonly uri: string;
  readonly mimeType?: string;
  /** Base64 encoded binary content */
  readonly blob: string;
}

/**
 * Union type for all resource content types.
 */
export type IResourceContent = ITextResourceContent | IBlobResourceContent;

/**
 * Resource definition for server builder registration.
 */
export interface IResourceDefinition {
  /** Unique resource URI */
  readonly uri: string;
  /** Human-readable name */
  readonly name: string;
  /** Description of the resource */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
  /** Content provider function */
  handler: () => Promise<IResourceContent[]>;
}

/**
 * Resource template definition (RFC 6570 URI Templates).
 */
export interface IResourceTemplateDefinition<TArgs = Record<string, string | string[]>> {
  /** URI template pattern (e.g., 'myapp://logs/{logId}') */
  readonly uriTemplate: string;
  /** Human-readable name */
  readonly name: string;
  /** Description */
  readonly description?: string;
  /** MIME type */
  readonly mimeType?: string;
  /** Optional argument schema */
  readonly argumentsSchema?: z.ZodSchema<TArgs>;
  /** Optional list function to enumerate available resources */
  list?: () => Promise<Array<{ uri: string; name?: string; description?: string; mimeType?: string }>>;
  /** Content provider function */
  handler: (args: TArgs) => Promise<IResourceContent[]>;
}

/**
 * Resource provider interface for custom resource registration.
 */
export interface IResourceProvider {
  /** Get all static resources */
  getResources(): ReadonlyArray<IResourceDefinition>;

  /** Get all resource templates */
  getTemplates(): ReadonlyArray<IResourceTemplateDefinition>;

  /** Check if provider has any resources */
  hasResources(): boolean;
}

// ============================================================================
// Prompt Registration Types
// ============================================================================

/**
 * Prompt argument definition.
 */
export interface IPromptArgumentDefinition {
  /** Argument name */
  readonly name: string;
  /** Argument description */
  readonly description: string;
  /** Whether required */
  readonly required?: boolean;
}

/**
 * Prompt message in generated prompts.
 */
export interface IPromptMessageDefinition {
  /** Role: user or assistant */
  readonly role: 'user' | 'assistant';
  /** Message content */
  readonly content: string;
}

/**
 * Prompt result with description and messages.
 */
export interface IPromptResult {
  /** Optional description of the generated prompt */
  readonly description?: string;
  /** Generated messages */
  readonly messages: ReadonlyArray<IPromptMessageDefinition>;
}

/**
 * Prompt definition for server builder registration.
 */
export interface IPromptDefinition {
  /** Unique prompt name */
  readonly name: string;
  /** Human-readable description */
  readonly description: string;
  /** Arguments accepted by this prompt */
  readonly arguments?: ReadonlyArray<IPromptArgumentDefinition>;
  /** Prompt handler */
  handler: (args: Record<string, string>) => Promise<IPromptResult>;
}

/**
 * Prompt provider interface for custom prompt registration.
 */
export interface IPromptProvider {
  /** Get all prompts */
  getPrompts(): ReadonlyArray<IPromptDefinition>;

  /** Check if provider has any prompts */
  hasPrompts(): boolean;
}

// ============================================================================
// Server Builder Interface
// ============================================================================

/**
 * Fluent builder interface for constructing MCP servers.
 *
 * Provides a declarative, type-safe API for configuring servers.
 *
 * @typeParam TClient - The API client type
 *
 * @example
 * ```typescript
 * const server = new McpServerBuilder<MyApiClient>()
 *   .withOptions({
 *     name: 'my-server',
 *     version: '1.0.0',
 *     transport: { mode: 'stdio' },
 *   })
 *   .withToolProvider(myToolProvider)
 *   .withResourceProvider(myResourceProvider)
 *   .build();
 *
 * await server.start();
 * ```
 */
export interface IServerBuilder<TClient extends IApiClient = IApiClient> {
  /**
   * Configure server options.
   */
  withOptions(options: IServerOptions<TClient>): IServerBuilder<TClient>;

  /**
   * Register a tool provider.
   */
  withToolProvider(provider: IToolProvider<TClient>): IServerBuilder<TClient>;

  /**
   * Register individual tools.
   */
  withTools(tools: ReadonlyArray<IToolDefinition<unknown, TClient>>): IServerBuilder<TClient>;

  /**
   * Register a resource provider.
   */
  withResourceProvider(provider: IResourceProvider): IServerBuilder<TClient>;

  /**
   * Register individual resources.
   */
  withResources(resources: ReadonlyArray<IResourceDefinition>): IServerBuilder<TClient>;

  /**
   * Register resource templates.
   */
  withResourceTemplates(templates: ReadonlyArray<IResourceTemplateDefinition>): IServerBuilder<TClient>;

  /**
   * Register a prompt provider.
   */
  withPromptProvider(provider: IPromptProvider): IServerBuilder<TClient>;

  /**
   * Register individual prompts.
   */
  withPrompts(prompts: ReadonlyArray<IPromptDefinition>): IServerBuilder<TClient>;

  /**
   * Build and return the configured server instance.
   */
  build(): IServerInstance;
}

// ============================================================================
// Internal Builder State
// ============================================================================

/**
 * Internal state tracked by the builder.
 * @internal
 */
export interface IBuilderState<TClient extends IApiClient = IApiClient> {
  options?: IServerOptions<TClient>;
  toolProviders: IToolProvider<TClient>[];
  tools: IToolDefinition<unknown, TClient>[];
  resourceProviders: IResourceProvider[];
  resources: IResourceDefinition[];
  resourceTemplates: IResourceTemplateDefinition[];
  promptProviders: IPromptProvider[];
  prompts: IPromptDefinition[];
}

/**
 * Creates a fresh builder state.
 */
export function createBuilderState<TClient extends IApiClient = IApiClient>(): IBuilderState<TClient> {
  return {
    options: undefined,
    toolProviders: [],
    tools: [],
    resourceProviders: [],
    resources: [],
    resourceTemplates: [],
    promptProviders: [],
    prompts: [],
  };
}
