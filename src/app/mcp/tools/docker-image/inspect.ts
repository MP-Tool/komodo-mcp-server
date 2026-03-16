import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to inspect a Docker image.
 */
export const inspectDockerImageTool: Tool = {
  name: 'komodo_inspect_docker_image',
  description: 'Get detailed information about a Docker image including layers, configuration, and metadata.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    image: z.string().describe('Docker image name or ID to inspect'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_inspect_docker_image');

    const result = await wrapApiCall(
      'inspectDockerImage',
      () => validClient.dockerImages.inspect(args.server, args.image, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(`Image "${args.image}" on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};
