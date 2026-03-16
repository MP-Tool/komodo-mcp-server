import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to list all Docker networks on a server.
 */
export const listDockerNetworksTool: Tool = {
  name: 'komodo_list_docker_networks',
  description: 'List all Docker networks on a server. Shows network name, driver, scope, and connected containers.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_docker_networks');

    const networks = await wrapApiCall(
      'listDockerNetworks',
      () => validClient.dockerNetworks.list(args.server, { signal: abortSignal }),
      abortSignal,
    );

    if (!Array.isArray(networks) || networks.length === 0) {
      return successResponse(`🌐 No Docker networks found on server "${args.server}".`);
    }

    const networkList = networks
      .map((item: unknown) => {
        const n = item as Record<string, unknown>;
        const name = n.Name || n.name || 'unknown';
        const driver = n.Driver || n.driver || 'unknown';
        const scope = n.Scope || n.scope || 'unknown';
        return `• ${name} (driver: ${driver}, scope: ${scope})`;
      })
      .join('\n');

    return successResponse(`🌐 Docker networks on server "${args.server}":\n\n${networkList}`);
  },
};
