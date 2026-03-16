import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to delete a Docker image.
 */
export const deleteDockerImageTool: Tool = {
  name: 'komodo_delete_docker_image',
  description: 'Delete a Docker image from a server. The image must not be in use by any container.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    name: z.string().describe('Docker image name or ID to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_docker_image');

    const result = await wrapApiCall(
      'deleteDockerImage',
      () => validClient.dockerImages.delete(args.server, args.name, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `Image "${args.name}" deleted from server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
