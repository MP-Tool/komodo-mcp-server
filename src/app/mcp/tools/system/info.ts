import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const getSystemInfoTool: Tool = {
  name: 'komodo_get_system_info',
  description:
    'Get detailed system information for a server including OS, CPU model, total memory, disk partitions, and architecture.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_system_info');
    const result = await wrapApiCall(
      'getSystemInfo',
      () => validClient.system.getSystemInfo(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`System info for server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getSystemStatsTool: Tool = {
  name: 'komodo_get_system_stats',
  description:
    'Get real-time system statistics for a server including CPU usage, memory usage, disk I/O, and network I/O.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_system_stats');
    const result = await wrapApiCall(
      'getSystemStats',
      () => validClient.system.getSystemStats(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`System stats for server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listSystemProcessesTool: Tool = {
  name: 'komodo_list_system_processes',
  description: 'List running processes on a server with CPU and memory usage per process.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_system_processes');
    const result = await wrapApiCall(
      'listSystemProcesses',
      () => validClient.system.listProcesses(args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Processes on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};
