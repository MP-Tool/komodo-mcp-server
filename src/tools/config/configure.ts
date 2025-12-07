import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoClient } from '../../api/index.js';

/**
 * Tool to configure the Komodo client connection.
 */
export const configureTool: Tool = {
  name: 'komodo_configure',
  description: 'Configure connection to Komodo server with username and password',
  schema: z.object({
    url: z.string().url(),
    username: z.string().min(1),
    password: z.string().min(1),
  }),
  requiresClient: false,
  handler: async (args, context) => {
    try {
      // Login to get JWT-Token
      const client = await KomodoClient.login(args.url, args.username, args.password);

      // Set the client in the context
      context.setClient(client);

      // Perform health check after configuration
      const health = await client.healthCheck();

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
