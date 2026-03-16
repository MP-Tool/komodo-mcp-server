import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to inspect a Docker volume on a server.
 */
export const inspectDockerVolumeTool: Tool = {
  name: 'komodo_inspect_docker_volume',
  description: 'Get detailed information about a Docker volume including mount point, driver, labels, and options.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    volume: z.string().describe('Docker volume name to inspect'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_inspect_docker_volume');

    const result = await wrapApiCall(
      'inspectDockerVolume',
      () => validClient.dockerVolumes.inspect(args.server, args.volume, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(`Volume "${args.volume}" on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};
