import { z } from 'zod';
import { Tool } from '../base.js';
import { CONTAINER_LOGS_DEFAULTS, ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to get logs from a container.
 */
export const getContainerLogsTool: Tool = {
  name: 'komodo_get_container_logs',
  description: 'Get logs from a specific container with optional tail and timestamp parameters',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
    container: z.string().describe('Container name or ID'),
    tail: z
      .number()
      .int()
      .positive()
      .optional()
      .default(CONTAINER_LOGS_DEFAULTS.TAIL)
      .describe(`Number of lines to show from the end of logs (default: ${CONTAINER_LOGS_DEFAULTS.TAIL})`),
    timestamps: z
      .boolean()
      .optional()
      .default(CONTAINER_LOGS_DEFAULTS.TIMESTAMPS)
      .describe(`Show timestamps in log output (default: ${CONTAINER_LOGS_DEFAULTS.TIMESTAMPS})`),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    const result = await client.containers.logs(args.server, args.container, args.tail, args.timestamps);

    // Extract stdout and stderr from Log object
    // Combine stdout and stderr with labels if both exist
    let logContent = '';

    if (result.stdout) {
      logContent += result.stdout;
    }

    if (result.stderr) {
      if (logContent) {
        logContent += '\n\n=== STDERR ===\n';
      }
      logContent += result.stderr;
    }

    // Fallback if both are empty
    if (!logContent) {
      logContent = 'No logs available';
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: logContent,
        },
      ],
    };
  },
};
