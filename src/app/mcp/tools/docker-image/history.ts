import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to get Docker image layer history.
 */
export const dockerImageHistoryTool: Tool = {
  name: 'komodo_docker_image_history',
  description: "Get the layer history of a Docker image, showing each layer's command, size, and creation date.",
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    image: z.string().describe('Docker image name or ID to get history for'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_docker_image_history');

    const result = await wrapApiCall(
      'dockerImageHistory',
      () => validClient.dockerImages.history(args.server, args.image, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `History for image "${args.image}" on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
