/**
 * Resource Factory
 *
 * Provides factory functions to reduce boilerplate when creating MCP resources.
 * Supports both static resources and dynamic resource templates.
 *
 * @module resources/factory
 */

import {
  resourceRegistry,
  type Resource,
  type ResourceTemplate,
  type ResourceContent,
  type ResourceListItem,
} from './base.js';

/**
 * Configuration for creating a static text resource
 */
export interface TextResourceConfig {
  /** Unique URI for this resource */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description of what this resource contains */
  description?: string;
  /** Function to generate the text content */
  getContent: () => Promise<string> | string;
}

/**
 * Configuration for creating a static JSON resource
 */
export interface JsonResourceConfig {
  /** Unique URI for this resource */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description of what this resource contains */
  description?: string;
  /** Function to generate the JSON content */
  getContent: () => Promise<Record<string, unknown>> | Record<string, unknown>;
}

/**
 * Configuration for creating a Markdown resource
 */
export interface MarkdownResourceConfig {
  /** Unique URI for this resource */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description of what this resource contains */
  description?: string;
  /** Function to generate the Markdown content */
  getContent: () => Promise<string> | string;
}

/**
 * Configuration for creating a dynamic resource template
 */
export interface DynamicResourceConfig<TArgs extends Record<string, string | string[]> = Record<string, string>> {
  /** URI template with placeholders (RFC 6570) */
  uriTemplate: string;
  /** Human-readable name */
  name: string;
  /** Description of what this template provides */
  description?: string;
  /** MIME type of the content */
  mimeType?: string;
  /** Function to list available resources */
  listResources: () => Promise<ResourceListItem[]>;
  /** Function to get content for specific arguments */
  getContent: (args: TArgs) => Promise<string>;
}

/**
 * Creates a static text resource.
 *
 * @param config - The resource configuration
 * @returns A Resource definition
 *
 * @example
 * ```typescript
 * createTextResource({
 *   uri: 'komodo://info/version',
 *   name: 'Server Version',
 *   description: 'Current server version information',
 *   getContent: () => `Version: ${SERVER_VERSION}`,
 * });
 * ```
 */
export function createTextResource(config: TextResourceConfig): Resource {
  const { uri, name, description, getContent } = config;

  return {
    uri,
    name,
    description,
    mimeType: 'text/plain',
    handler: async (): Promise<ResourceContent[]> => {
      const content = await Promise.resolve(getContent());
      return [{ uri, text: content, mimeType: 'text/plain' }];
    },
  };
}

/**
 * Creates a static JSON resource.
 *
 * @param config - The resource configuration
 * @returns A Resource definition
 *
 * @example
 * ```typescript
 * createJsonResource({
 *   uri: 'komodo://info/config',
 *   name: 'Server Configuration',
 *   description: 'Current server configuration',
 *   getContent: () => ({ version: '1.0.0', env: 'production' }),
 * });
 * ```
 */
export function createJsonResource(config: JsonResourceConfig): Resource {
  const { uri, name, description, getContent } = config;

  return {
    uri,
    name,
    description,
    mimeType: 'application/json',
    handler: async (): Promise<ResourceContent[]> => {
      const content = await Promise.resolve(getContent());
      const jsonString = JSON.stringify(content, null, 2);
      return [{ uri, text: jsonString, mimeType: 'application/json' }];
    },
  };
}

/**
 * Creates a static Markdown resource.
 *
 * @param config - The resource configuration
 * @returns A Resource definition
 *
 * @example
 * ```typescript
 * createMarkdownResource({
 *   uri: 'komodo://docs/getting-started',
 *   name: 'Getting Started Guide',
 *   description: 'How to get started with Komodo',
 *   getContent: () => '# Getting Started\n\n...',
 * });
 * ```
 */
export function createMarkdownResource(config: MarkdownResourceConfig): Resource {
  const { uri, name, description, getContent } = config;

  return {
    uri,
    name,
    description,
    mimeType: 'text/markdown',
    handler: async (): Promise<ResourceContent[]> => {
      const content = await Promise.resolve(getContent());
      return [{ uri, text: content, mimeType: 'text/markdown' }];
    },
  };
}

/**
 * Creates a dynamic resource template.
 *
 * @param config - The resource template configuration
 * @returns A ResourceTemplate definition
 *
 * @example
 * ```typescript
 * createDynamicResource({
 *   uriTemplate: 'komodo://server/{serverId}/logs',
 *   name: 'Server Logs',
 *   description: 'Logs for a specific server',
 *   mimeType: 'text/plain',
 *   listResources: async () => {
 *     const servers = await listServers();
 *     return servers.map(s => ({ uri: `komodo://server/${s.id}/logs` }));
 *   },
 *   getContent: async (args) => {
 *     return await fetchLogs(args.serverId);
 *   },
 * });
 * ```
 */
export function createDynamicResource<TArgs extends Record<string, string | string[]>>(
  config: DynamicResourceConfig<TArgs>,
): ResourceTemplate<TArgs> {
  const { uriTemplate, name, description, mimeType = 'text/plain', listResources, getContent } = config;

  return {
    uriTemplate,
    name,
    description,
    mimeType,
    list: listResources,
    handler: async (args: TArgs): Promise<ResourceContent[]> => {
      const content = await getContent(args);
      // Generate concrete URI from template and args
      let concreteUri = uriTemplate;
      for (const [key, value] of Object.entries(args)) {
        const replacement = Array.isArray(value) ? value.join(',') : value;
        concreteUri = concreteUri.replace(`{${key}}`, replacement);
      }
      return [{ uri: concreteUri, text: content, mimeType }];
    },
  };
}

/**
 * Registers a text resource with the registry.
 *
 * @param config - The resource configuration
 */
export function registerTextResource(config: TextResourceConfig): void {
  const resource = createTextResource(config);
  resourceRegistry.register(resource);
}

/**
 * Registers a JSON resource with the registry.
 *
 * @param config - The resource configuration
 */
export function registerJsonResource(config: JsonResourceConfig): void {
  const resource = createJsonResource(config);
  resourceRegistry.register(resource);
}

/**
 * Registers a Markdown resource with the registry.
 *
 * @param config - The resource configuration
 */
export function registerMarkdownResource(config: MarkdownResourceConfig): void {
  const resource = createMarkdownResource(config);
  resourceRegistry.register(resource);
}

/**
 * Registers a dynamic resource template with the registry.
 *
 * @param config - The resource template configuration
 */
export function registerDynamicResource<TArgs extends Record<string, string | string[]>>(
  config: DynamicResourceConfig<TArgs>,
): void {
  const template = createDynamicResource(config);
  resourceRegistry.registerTemplate(template);
}

/**
 * Helper to create multiple resources at once.
 *
 * @param configs - Array of resource configurations
 * @returns Array of Resource definitions
 */
export function createTextResources(configs: TextResourceConfig[]): Resource[] {
  return configs.map(createTextResource);
}

/**
 * Helper to create multiple JSON resources at once.
 *
 * @param configs - Array of resource configurations
 * @returns Array of Resource definitions
 */
export function createJsonResources(configs: JsonResourceConfig[]): Resource[] {
  return configs.map(createJsonResource);
}
