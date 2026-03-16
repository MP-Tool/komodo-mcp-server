import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to delete a Docker volume from a server.
 */
export const deleteDockerVolumeTool: Tool = {
  name: 'komodo_delete_docker_volume',
  description: 'Delete a Docker volume from a server. The volume must not be in use by any container.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    name: z.string().describe('Docker volume name to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_docker_volume');

    const result = await wrapApiCall(
      'deleteDockerVolume',
      () => validClient.dockerVolumes.delete(args.server, args.name, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `Volume "${args.name}" deleted from server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
