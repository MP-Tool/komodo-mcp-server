import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to delete a Docker network from a server.
 */
export const deleteDockerNetworkTool: Tool = {
  name: 'komodo_delete_docker_network',
  description: 'Delete a Docker network from a server. The network must not have any connected containers.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    name: z.string().describe('Docker network name to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_docker_network');

    const result = await wrapApiCall(
      'deleteDockerNetwork',
      () => validClient.dockerNetworks.delete(args.server, args.name, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `🗑️ Network "${args.name}" deleted from server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
