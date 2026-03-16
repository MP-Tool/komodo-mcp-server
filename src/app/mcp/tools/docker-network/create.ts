import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to create a new Docker network on a server.
 */
export const createDockerNetworkTool: Tool = {
  name: 'komodo_create_docker_network',
  description: 'Create a new Docker network on a server.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    name: z.string().describe('Name for the new Docker network'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_docker_network');

    const result = await wrapApiCall(
      'createDockerNetwork',
      () => validClient.dockerNetworks.create(args.server, args.name, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `✨ Network "${args.name}" created on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
