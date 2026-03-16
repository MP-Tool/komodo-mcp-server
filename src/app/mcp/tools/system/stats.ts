import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const getHistoricalStatsTool: Tool = {
  name: 'komodo_get_historical_server_stats',
  description:
    'Get historical server statistics at various time granularities. Useful for trending and capacity planning.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    granularity: z
      .enum(['15-seconds', '5-minutes', '15-minutes', '1-hour', '1-day'])
      .describe('Time granularity for data points. Smaller granularity = more detail but shorter retention.'),
    page: z.number().optional().describe('Page number for pagination (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_historical_server_stats');
    const result = await wrapApiCall(
      'getHistoricalServerStats',
      () => validClient.system.getHistoricalStats(args.server, args.granularity, args.page, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Historical stats for server "${args.server}" (${args.granularity}):\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const getPeripheryVersionTool: Tool = {
  name: 'komodo_get_periphery_version',
  description: 'Get the version of the Komodo periphery agent running on a server.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_periphery_version');
    const result = await wrapApiCall(
      'getPeripheryVersion',
      () => validClient.system.getPeripheryVersion(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Periphery version on server "${args.server}": ${JSON.stringify(result, null, 2)}`);
  },
};

export const getCoreInfoTool: Tool = {
  name: 'komodo_get_core_info',
  description: 'Get information about the Komodo Core server including version, configuration, and runtime details.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_core_info');
    const result = await wrapApiCall(
      'getCoreInfo',
      () => validClient.system.getCoreInfo({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Komodo Core Info:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listComposeProjectsTool: Tool = {
  name: 'komodo_list_compose_projects',
  description: 'List all Docker Compose projects running on a server.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_compose_projects');
    const result = await wrapApiCall(
      'listComposeProjects',
      () => validClient.system.listComposeProjects(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Compose projects on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getServersSummaryTool: Tool = {
  name: 'komodo_get_servers_summary',
  description: 'Get a summary overview of all registered servers including health status, resource counts, and alerts.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_servers_summary');
    const result = await wrapApiCall(
      'getServersSummary',
      () => validClient.system.getServersSummary({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Servers Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};
