/**
 * Resource Registry
 *
 * Provides infrastructure for MCP Resources.
 * Resources expose data and content from the server to clients.
 *
 * Per MCP Spec 2025-11-25:
 * - Resources are identified by URIs
 * - Resources can be static or dynamic (templates)
 * - Server can notify clients of resource list changes
 *
 * Future use cases:
 * - Komodo documentation
 * - Server/deployment status pages
 * - Log file access
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/server/resources
 */

import { z } from 'zod';

/**
 * Resource content types
 */
interface TextResourceContent {
  uri: string;
  mimeType?: string;
  text: string;
}

interface BlobResourceContent {
  uri: string;
  mimeType?: string;
  blob: string; // Base64 encoded
}

type ResourceContent = TextResourceContent | BlobResourceContent;

/**
 * Definition of an MCP Resource
 */
interface Resource {
  /** Unique URI identifying this resource */
  uri: string;
  /** Human-readable name */
  name: string;
  /** Description of what this resource contains */
  description?: string;
  /** MIME type of the resource content */
  mimeType?: string;
  /** Handler to read the resource content */
  handler: () => Promise<ResourceContent[]>;
}

/**
 * Definition of an MCP Resource Template (dynamic resources)
 */
interface ResourceTemplate {
  /** URI template with placeholders (e.g., "komodo://server/{serverId}/logs") */
  uriTemplate: string;
  /** Human-readable name */
  name: string;
  /** Description of what this template provides */
  description?: string;
  /** MIME type of the resource content */
  mimeType?: string;
  /** Zod schema for validating template arguments */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  argumentsSchema?: z.ZodSchema<any>;
  /** Handler to read the resource content */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any) => Promise<ResourceContent[]>;
}

/**
 * Registry for managing available resources.
 *
 * When resources are registered, the server should advertise
 * the `resources` capability to clients.
 * @internal Not exported - use resourceRegistry instance instead
 */
class ResourceRegistry {
  private resources: Map<string, Resource> = new Map();
  private templates: Map<string, ResourceTemplate> = new Map();

  /**
   * Registers a static resource.
   * @throws Error if a resource with the same URI is already registered.
   */
  register(resource: Resource): void {
    if (this.resources.has(resource.uri)) {
      throw new Error(`Resource ${resource.uri} is already registered`);
    }
    this.resources.set(resource.uri, resource);
  }

  /**
   * Registers a resource template (dynamic resource).
   * @throws Error if a template with the same URI is already registered.
   */
  registerTemplate(template: ResourceTemplate): void {
    if (this.templates.has(template.uriTemplate)) {
      throw new Error(`Resource template ${template.uriTemplate} is already registered`);
    }
    this.templates.set(template.uriTemplate, template);
  }

  /**
   * Retrieves a resource by URI.
   */
  getResource(uri: string): Resource | undefined {
    return this.resources.get(uri);
  }

  /**
   * Retrieves a template by URI template.
   */
  getTemplate(uriTemplate: string): ResourceTemplate | undefined {
    return this.templates.get(uriTemplate);
  }

  /**
   * Returns all registered resources.
   */
  getResources(): Resource[] {
    return Array.from(this.resources.values());
  }

  /**
   * Returns all registered templates.
   */
  getTemplates(): ResourceTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Returns true if any resources or templates are registered.
   */
  hasResources(): boolean {
    return this.resources.size > 0 || this.templates.size > 0;
  }

  /**
   * Returns the count of registered resources and templates.
   */
  getCount(): { resources: number; templates: number } {
    return {
      resources: this.resources.size,
      templates: this.templates.size,
    };
  }
}

/** Singleton instance */
export const resourceRegistry = new ResourceRegistry();
