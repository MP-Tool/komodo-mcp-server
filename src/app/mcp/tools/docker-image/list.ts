import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to list all Docker images on a server.
 */
export const listDockerImagesTool: Tool = {
  name: 'komodo_list_docker_images',
  description: 'List all Docker images on a server. Shows image repository, tag, size, and creation date.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_docker_images');

    const images = await wrapApiCall(
      'listDockerImages',
      () => validClient.dockerImages.list(args.server, { signal: abortSignal }),
      abortSignal,
    );

    if (!Array.isArray(images) || images.length === 0) {
      return successResponse(`No Docker images found on server "${args.server}".`);
    }

    const imageList = images
      .map((item: unknown) => {
        const img = item as Record<string, unknown>;
        const repoTags = (img.RepoTags as string[]) || ['<none>:<none>'];
        const size = img.Size ? `${Math.round((img.Size as number) / 1024 / 1024)}MB` : 'unknown';
        return repoTags.map((tag: string) => `• ${tag} (${size})`).join('\n');
      })
      .join('\n');

    return successResponse(`Docker images on server "${args.server}":\n\n${imageList}`);
  },
};
