/**
 * Resources Module
 *
 * Provides resource registry instance for registering and managing MCP resources.
 *
 * MCP Resources provide read-only data to clients. Two types are supported:
 * - Static Resources: Fixed URIs (e.g., "komodo://example/server-info")
 * - Resource Templates: Dynamic URIs with placeholders (e.g., "komodo://server/{serverId}/logs")
 *
 * Resource Templates use RFC 6570 URI Template syntax and are matched
 * at runtime when clients request resources.
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/server/resources
 */

export {
  resourceRegistry,
  type Resource,
  type ResourceContent,
  type ResourceListItem,
  type ResourceTemplate,
  type TextResourceContent,
  type BlobResourceContent,
} from './base.js';

// Export factory functions
export {
  createTextResource,
  createJsonResource,
  createMarkdownResource,
  createDynamicResource,
  registerTextResource,
  registerJsonResource,
  registerMarkdownResource,
  registerDynamicResource,
  createTextResources,
  createJsonResources,
  type TextResourceConfig,
  type JsonResourceConfig,
  type MarkdownResourceConfig,
  type DynamicResourceConfig,
} from './factory.js';

import { registerExampleResource } from './example-server-info.js';
import { registerExampleTemplateResource } from './example-server-logs.js';

/**
 * Register all resources.
 * Call this function during server initialization.
 *
 * Resources provide read-only data to MCP clients. They can be:
 * - Static content (documentation, configuration)
 * - Dynamic content (server status, metrics)
 * - Template-based with URI parameters (RFC 6570)
 *
 * @example Adding a new resource
 * ```typescript
 * import { registerMyResource } from './my-resource.js';
 *
 * export function registerResources(): void {
 *   registerExampleServerInfoResource();  // Keep for reference
 *   registerMyResource();                  // Add your resource
 * }
 * ```
 */
export function registerResources(): void {
  // Example resource - demonstrates static resource implementation
  // See example-server-info.ts for implementation details
  registerExampleResource();

  // Example resource template - demonstrates RFC 6570 URI Templates
  // See example-server-logs.ts for implementation details
  registerExampleTemplateResource();

  // FUTURE: Production resources (v1.2.0+)
  // - komodo://servers: List all Komodo servers
  // - komodo://server/{id}/config: Server configuration
}
