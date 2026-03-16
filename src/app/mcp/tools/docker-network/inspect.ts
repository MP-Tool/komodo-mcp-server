import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to inspect a specific Docker network.
 */
export const inspectDockerNetworkTool: Tool = {
  name: 'komodo_inspect_docker_network',
  description:
    'Get detailed information about a Docker network including connected containers, IPAM config, and options.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    network: z.string().describe('Docker network name or ID to inspect'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_inspect_docker_network');

    const result = await wrapApiCall(
      'inspectDockerNetwork',
      () => validClient.dockerNetworks.inspect(args.server, args.network, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `🌐 Network "${args.network}" on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
