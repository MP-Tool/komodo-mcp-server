import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES } from '../../config/constants.js';
import { PARAM_DESCRIPTIONS } from '../../config/descriptions.js';

/**
 * Tool to inspect a container.
 */
export const inspectContainerTool: Tool = {
  name: 'komodo_inspect_container',
  description:
    'Get detailed low-level information about a container. Returns Docker inspect data including configuration, state, network settings, mounts, and process info.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_INSPECT),
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
