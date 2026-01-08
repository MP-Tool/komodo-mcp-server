import { z } from 'zod';
import { Tool } from '../base.js';
import { CONTAINER_LOGS_DEFAULTS, ERROR_MESSAGES, PARAM_DESCRIPTIONS, LOG_DESCRIPTIONS } from '../../config/index.js';

/**
 * Tool to get logs from a container.
 */
export const getContainerLogsTool: Tool = {
  name: 'komodo_get_container_logs',
  description:
    'Get stdout and stderr logs from a container. Useful for debugging, monitoring application output, and troubleshooting issues.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_LOGS),
    tail: z
      .number()
      .int()
      .positive()
      .optional()
      .default(CONTAINER_LOGS_DEFAULTS.TAIL)
      .describe(LOG_DESCRIPTIONS.TAIL_LINES(CONTAINER_LOGS_DEFAULTS.TAIL)),
    timestamps: z
      .boolean()
      .optional()
      .default(CONTAINER_LOGS_DEFAULTS.TIMESTAMPS)
      .describe(LOG_DESCRIPTIONS.TIMESTAMPS(CONTAINER_LOGS_DEFAULTS.TIMESTAMPS)),
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
