/**
 * Example Resource: Server Info
 *
 * ============================================================================
 * ⚠️  EXAMPLE RESOURCE - FOR DEMONSTRATION PURPOSES ONLY
 * ============================================================================
 *
 * This is an example resource implementation that demonstrates:
 * - How to define and register MCP resources
 * - The resource handler pattern with async content generation
 * - Proper typing with ResourceContent
 *
 * This resource provides basic server information and can be used as a
 * template for creating new production resources.
 *
 * To create a new resource:
 * 1. Copy this file and rename it (e.g., `my-resource.ts`)
 * 2. Update the URI, name, and description
 * 3. Implement the handler to return your resource content
 * 4. Register it in `index.ts`
 *
 * @example Creating a custom resource
 * ```typescript
 * resourceRegistry.register({
 *   uri: 'komodo://my/resource',
 *   name: 'My Resource',
 *   description: 'Description of what this resource provides',
 *   mimeType: 'application/json',
 *   handler: async () => [{
 *     uri: 'komodo://my/resource',
 *     mimeType: 'application/json',
 *     text: JSON.stringify({ data: 'example' }),
 *   }],
 * });
 * ```
 */

import { resourceRegistry } from './index.js';
import { config, SERVER_NAME, SERVER_VERSION } from '../config/index.js';

/**
 * Registers the example server info resource.
 *
 * This resource exposes basic server configuration and capabilities,
 * primarily useful for:
 * - Testing the resource infrastructure
 * - Demonstrating resource implementation patterns
 * - Providing server metadata to MCP clients
 */
export function registerExampleResource(): void {
  resourceRegistry.register({
    uri: 'komodo://example/server-info',
    name: '[Example] Server Information',
    description:
      'Example resource that provides information about the Komodo MCP Server. ' +
      'Demonstrates how to implement MCP resources.',
    mimeType: 'application/json',
    handler: async () => {
      const serverInfo = {
        _example: true,
        _note: 'This is an example resource for demonstration purposes',
        name: SERVER_NAME,
        version: SERVER_VERSION,
        transport: config.MCP_TRANSPORT,
        environment: config.NODE_ENV,
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
          logging: true,
        },
        endpoints: {
          mcp: config.MCP_TRANSPORT === 'http' ? `http://${config.MCP_BIND_HOST}:${config.MCP_PORT}/mcp` : 'stdio',
        },
      };

      return [
        {
          uri: 'komodo://example/server-info',
          mimeType: 'application/json',
          text: JSON.stringify(serverInfo, null, 2),
        },
      ];
    },
  });
}
