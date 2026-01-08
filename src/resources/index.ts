/**
 * Resources Module
 *
 * Provides resource registry instance for registering and managing MCP resources.
 */

export { resourceRegistry } from './base.js';

import { registerExampleResource } from './example-server-info.js';

/**
 * Register all resources.
 * Call this function during server initialization.
 *
 * Resources provide read-only data to MCP clients. They can be:
 * - Static content (documentation, configuration)
 * - Dynamic content (server status, metrics)
 * - Template-based with URI parameters
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
  // Example resource - demonstrates resource implementation pattern
  // See example-server-info.ts for implementation details
  registerExampleResource();

  // TODO: Add production resources here
  // registerKomodoServerListResource();
  // registerDeploymentStatusResource();
}
