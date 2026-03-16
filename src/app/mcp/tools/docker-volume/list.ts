import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to list all Docker volumes on a server.
 */
export const listDockerVolumesTool: Tool = {
  name: 'komodo_list_docker_volumes',
  description: 'List all Docker volumes on a server. Shows volume name, driver, mount point, and usage.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_docker_volumes');

    const volumes = await wrapApiCall(
      'listDockerVolumes',
      () => validClient.dockerVolumes.list(args.server, { signal: abortSignal }),
      abortSignal,
    );

    if (!Array.isArray(volumes) || volumes.length === 0) {
      return successResponse(`No Docker volumes found on server "${args.server}".`);
    }

    const volumeList = volumes
      .map((item: unknown) => {
        const v = item as Record<string, unknown>;
        const name = v.Name || v.name || 'unknown';
        const driver = v.Driver || v.driver || 'local';
        return `• ${name} (driver: ${driver})`;
      })
      .join('\n');

    return successResponse(`Docker volumes on server "${args.server}":\n\n${volumeList}`);
  },
};
