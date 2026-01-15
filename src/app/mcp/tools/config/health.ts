import { z } from 'zod';
import { Tool } from '../base.js';
import type { HealthCheckResult } from '../../../api/types.js';

// Re-use HealthCheckResult details type
type KomodoHealthCheckDetails = HealthCheckResult['details'];

/**
 * Type guard to check if health details are Komodo-specific.
 */
function isKomodoHealthDetails(details: unknown): details is KomodoHealthCheckDetails {
  return (
    typeof details === 'object' &&
    details !== null &&
    'url' in details &&
    'reachable' in details &&
    'authenticated' in details &&
    'responseTime' in details
  );
}

/**
 * Tool to check the health of the Komodo server connection.
 */
export const healthCheckTool: Tool = {
  name: 'komodo_health_check',
  description:
    'Check connection to Komodo Core server. Returns health status, response time, authentication status, and Komodo-API version. Use this to verify the connection is working properly.',
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
              `• url: Komodo server URL (e.g. http://localhost:9120)\n` +
              `• username: Your Komodo username\n` +
              `• password: Your Komodo password`,
          },
        ],
      };
    }

    try {
      const health = await client.healthCheck();
      const details = isKomodoHealthDetails(health.details) ? health.details : null;

      if (health.status === 'healthy' && details) {
        /* v8 ignore start - template string formatting branches */
        return {
          content: [
            {
              type: 'text',
              text:
                `✅ Komodo server is reachable!\n\n` +
                `🌐 Server: ${details.url}\n` +
                `⚡ Response Time: ${details.responseTime}ms\n` +
                `🔐 Authentication: ${details.authenticated ? '✅ OK' : '❌ Failed'}\n` +
                `${details.apiVersion ? `📦 API Version: ${details.apiVersion}\n` : ''}` +
                `\nStatus: ${health.message} 🎉`,
            },
          ],
        };
        /* v8 ignore stop */
      } else if (details) {
        /* v8 ignore start - template string formatting branches */
        return {
          content: [
            {
              type: 'text',
              text:
                `❌ Komodo server health check failed!\n\n` +
                `🌐 Server: ${details.url}\n` +
                `📡 Reachable: ${details.reachable ? '✅ Yes' : '❌ No'}\n` +
                `🔐 Authenticated: ${details.authenticated ? '✅ Yes' : '❌ No'}\n` +
                `⏱️ Response Time: ${details.responseTime}ms\n\n` +
                `❗ Problem: ${health.message}\n` +
                `${details.error ? `\n🔍 Details:\n${details.error}\n` : ''}` +
                `\n💡 Troubleshooting:\n` +
                `${
                  !details.reachable
                    ? `• Server not reachable - check URL and network\n` +
                      `• Is the Komodo server running?\n` +
                      `• Check firewall settings\n`
                    : ''
                }` +
                `${
                  details.reachable && !details.authenticated
                    ? `• Authentication failed\n` +
                      `• Please login again with 'komodo_configure'\n` +
                      `• Check username and password\n`
                    : ''
                }`,
            },
          ],
        };
        /* v8 ignore stop */
      } else {
        // Fallback for non-Komodo health check responses
        return {
          content: [
            {
              type: 'text',
              text:
                health.status === 'healthy'
                  ? `✅ Server is healthy: ${health.message || 'OK'}`
                  : `❌ Health check failed: ${health.message || 'Unknown error'}`,
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
