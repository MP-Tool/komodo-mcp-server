import { z } from 'zod';
import { Tool } from '../base.js';

/**
 * Tool to check the health of the Komodo server connection.
 */
export const healthCheckTool: Tool = {
  name: 'komodo_health_check',
  description: 'Check connection to Komodo server and return detailed diagnostic information',
  schema: z.object({}),
  requiresClient: false,
  handler: async (_args, { client }) => {
    if (!client) {
      return {
        content: [
          {
            type: 'text',
            text:
              `⚠️ Komodo Client not configured\n\n` +
              `Please use 'komodo_configure' first to establish a connection.\n\n` +
              `Required parameters:\n` +
              `• url: Komodo server URL (e.g. http://localhost:9121)\n` +
              `• username: Your Komodo username\n` +
              `• password: Your Komodo password`,
          },
        ],
      };
    }

    try {
      const health = await client.healthCheck();

      if (health.status === 'healthy') {
        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Komodo server is reachable!\n\n` +
                `🌐 Server: ${health.details.url}\n` +
                `⚡ Response Time: ${health.details.responseTime}ms\n` +
                `🔐 Authentication: ${health.details.authenticated ? '✅ OK' : '❌ Failed'}\n` +
                `${health.details.apiVersion ? `📦 API Version: ${health.details.apiVersion}\n` : ''}` +
                `\nStatus: ${health.message} 🎉`,
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text:
                `❌ Komodo server health check failed!\n\n` +
                `🌐 Server: ${health.details.url}\n` +
                `📡 Reachable: ${health.details.reachable ? '✅ Yes' : '❌ No'}\n` +
                `🔐 Authenticated: ${health.details.authenticated ? '✅ Yes' : '❌ No'}\n` +
                `⏱️ Response Time: ${health.details.responseTime}ms\n\n` +
                `❗ Problem: ${health.message}\n` +
                `${health.details.error ? `\n🔍 Details:\n${health.details.error}\n` : ''}` +
                `\n💡 Troubleshooting:\n` +
                `${
                  !health.details.reachable
                    ? `• Server not reachable - check URL and network\n` +
                      `• Is the Komodo server running?\n` +
                      `• Check firewall settings\n`
                    : ''
                }` +
                `${
                  health.details.reachable && !health.details.authenticated
                    ? `• Authentication failed\n` +
                      `• Please login again with 'komodo_configure'\n` +
                      `• Check username and password\n`
                    : ''
                }`,
            },
          ],
        };
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text:
              `❌ Health check error!\n\n` +
              `Unexpected error during health check:\n` +
              `${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
};
