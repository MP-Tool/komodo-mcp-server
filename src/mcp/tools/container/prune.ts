import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { pruneTargetSchema } from '../schemas/index.js';
import { formatPruneResponse } from '../../../utils/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to prune unused resources.
 */
export const pruneResourcesTool: Tool = {
  name: 'komodo_prune',
  description:
    'Prune unused resources on a server. This permanently removes stopped containers, unused images, volumes, or networks to free up resources.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    pruneTarget: pruneTargetSchema,
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_prune');
    const result = await wrapApiCall(
      'pruneResources',
      () => validClient.containers.prune(args.server, args.pruneTarget, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatPruneResponse({
        target: args.pruneTarget,
        serverName: args.server,
        output: `Status: ${result.status}`,
      }),
    );
  },
};
