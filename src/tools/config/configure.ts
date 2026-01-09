import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoClient } from '../../api/index.js';
import { toolRegistry } from '../index.js';

/**
 * Tool to configure the Komodo client connection.
 */
export const configureTool: Tool = {
  name: 'komodo_configure',
  description:
    'Configure connection to Komodo Core server. A valid connection MUST be established before using any other Komodo tools. Authenticates with username/password and establishes a session.',
  schema: z.object({
    url: z
      .string()
      .url()
      .describe('Komodo Core server URL (e.g., http://localhost:9120 or https://komodo.example.com)'),
    username: z.string().min(1).describe('Komodo username for authentication'),
    password: z.string().min(1).describe('Komodo password for authentication'),
  }),
  requiresClient: false,
  handler: async (args, context) => {
    try {
      // Login to get JWT-Token
      const client = await KomodoClient.login(args.url, args.username, args.password);

      // Set the client in the context (this triggers connection state change)
      await context.setClient(client);

      // Perform health check after configuration
      const health = await client.healthCheck();

      // Get count of now available tools
      const availableTools = toolRegistry.getAvailableTools().length;
      const totalTools = toolRegistry.getTools().length;

      if (health.status === 'healthy') {
        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Komodo Client successfully configured!\n\n` +
                `🌐 Server: ${args.url}\n` +
                `👤 User: ${args.username}\n` +
                `⚡ Response Time: ${health.details.responseTime}ms\n` +
                `🔐 Authentication: OK\n` +
                `${health.details.apiVersion ? `📦 API Version: ${health.details.apiVersion}\n` : ''}` +
                `🔧 Tools Available: ${availableTools}/${totalTools}\n` +
                `\nReady for container management! 🚀`,
            },
          ],
        };
      } else {
        // Configuration created but unhealthy
        return {
          content: [
            {
              type: 'text',
              text:
                `⚠️ Login successful, but health check failed:\n\n` +
                `🌐 Server: ${args.url}\n` +
                `👤 User: ${args.username}\n` +
                `❌ Status: ${health.message}\n` +
                `${health.details.error ? `🔍 Details: ${health.details.error}\n` : ''}` +
                `\nPlease check your configuration!`,
            },
          ],
        };
      }
    } catch (error) {
      throw new Error(`Failed to configure Komodo client: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
};
