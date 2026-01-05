import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to inspect a container.
 */
export const inspectContainerTool: Tool = {
  name: 'komodo_inspect_container',
  description: 'Get detailed information about a specific container',
  schema: z.object({
    server: z.string().describe('Server ID or name'),
    container: z.string().describe('Container name or ID'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.containers.inspect(args.server, args.container);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};
