/**
 * Example Resource Template: Server Logs
 *
 * ============================================================================
 * ⚠️  EXAMPLE RESOURCE TEMPLATE - FOR DEMONSTRATION PURPOSES ONLY
 * ============================================================================
 *
 * This is an example resource template implementation that demonstrates:
 * - How to define and register MCP resource templates
 * - RFC 6570 URI Template syntax with placeholders
 * - The template handler pattern with variable extraction
 * - Proper typing with ResourceContent
 *
 * Resource templates allow clients to request resources with dynamic URIs.
 * The URI template uses RFC 6570 syntax for variable placeholders.
 *
 * To create a new resource template:
 * 1. Copy this file and rename it (e.g., `my-template.ts`)
 * 2. Update the uriTemplate, name, and description
 * 3. Implement the handler to return your resource content
 * 4. Register it in `index.ts`
 *
 * @example Creating a custom resource template
 * ```typescript
 * resourceRegistry.registerTemplate({
 *   uriTemplate: 'komodo://deployment/{deploymentId}/status',
 *   name: 'Deployment Status',
 *   description: 'Get status for a specific deployment',
 *   mimeType: 'application/json',
 *   handler: async (args) => {
 *     const status = await getDeploymentStatus(args.deploymentId);
 *     return [{
 *       uri: `komodo://deployment/${args.deploymentId}/status`,
 *       mimeType: 'application/json',
 *       text: JSON.stringify(status),
 *     }];
 *   },
 * });
 * ```
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/server/resources#resource-templates
 * @see https://datatracker.ietf.org/doc/html/rfc6570
 */

import { z } from 'zod';
import { resourceRegistry, type ResourceContent, type ResourceListItem } from './index.js';

/**
 * Schema for validating server log template arguments
 */
const serverLogArgsSchema = z.object({
  serverId: z.string().min(1, 'serverId is required'),
});

type ServerLogArgs = z.infer<typeof serverLogArgsSchema>;

/**
 * Registers the example server logs resource template.
 *
 * This template demonstrates dynamic resource URIs with variable placeholders.
 * It uses RFC 6570 URI Template syntax: {variableName}
 *
 * URI Pattern: komodo://example/server/{serverId}/logs
 *
 * This is a mock implementation - in production, this would:
 * - Connect to Komodo API to fetch actual server logs
 * - Support additional parameters like tail/since
 * - Handle authentication and authorization
 */
export function registerExampleTemplateResource(): void {
  resourceRegistry.registerTemplate<ServerLogArgs>({
    uriTemplate: 'komodo://example/server/{serverId}/logs',
    name: '[Example] Server Logs Template',
    description:
      'Example resource template that demonstrates dynamic URI patterns. ' +
      'Uses RFC 6570 URI Template syntax with {serverId} placeholder. ' +
      'In production, this would fetch actual server logs from Komodo.',
    mimeType: 'text/plain',
    argumentsSchema: serverLogArgsSchema,

    /**
     * List available resources for this template.
     * Returns mock server IDs for demonstration purposes.
     *
     * In production, this would query the Komodo API to list all servers
     * and return their URIs.
     */
    list: async (): Promise<ResourceListItem[]> => {
      // Mock server IDs for demonstration
      const mockServerIds = ['server-alpha', 'server-beta', 'server-gamma'];

      return mockServerIds.map((serverId) => ({
        uri: `komodo://example/server/${serverId}/logs`,
        name: `Logs for ${serverId}`,
        description: `Example log resource for server ${serverId}`,
      }));
    },

    handler: async (args: ServerLogArgs): Promise<ResourceContent[]> => {
      const { serverId } = args;

      // Mock log output for demonstration
      const mockLogs = [
        `[${new Date().toISOString()}] Server ${serverId} - Example log entry 1`,
        `[${new Date().toISOString()}] Server ${serverId} - Example log entry 2`,
        `[${new Date().toISOString()}] Server ${serverId} - This is a mock resource template`,
        `[${new Date().toISOString()}] Server ${serverId} - In production, real logs would appear here`,
        '',
        '---',
        'NOTE: This is an example resource template demonstrating RFC 6570 URI Templates.',
        'The {serverId} placeholder was extracted from the requested URI.',
        'To implement real server logs, connect to the Komodo API.',
      ].join('\n');

      return [
        {
          uri: `komodo://example/server/${serverId}/logs`,
          mimeType: 'text/plain',
          text: mockLogs,
        },
      ];
    },
  });
}
