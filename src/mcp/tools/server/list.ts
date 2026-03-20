import { z } from 'zod';
import { Tool } from '../base.js';
import { Types } from '../../../api/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

type ServerListItem = Types.ServerListItem;

/**
 * Tool to list all available servers.
 */
export const listServersTool: Tool = {
  name: 'komodo_list_servers',
  description:
    'List all servers registered in Komodo. Shows server name, ID, status (healthy/unhealthy/disabled), Periphery version, and region. Use this to discover available servers before performing container or deployment operations.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_servers');
    const servers = await wrapApiCall(
      'listServers',
      () => komodoClient.servers.list({ signal: abortSignal }),
      abortSignal,
    );
    const serverList =
      servers
        .map((s: ServerListItem) => {
          const version = s.info.version && s.info.version.toLowerCase() !== 'unknown' ? s.info.version : 'N/A';
          const region = s.info.region || '';
          const regionStr = region ? ` | Region: ${region}` : '';
          return `• ${s.name} (${s.id}) - Status: ${s.info.state} | Version: ${version}${regionStr}`;
        })
        .join('\n') || 'No servers found.';

    return successResponse(`🖥️ Available servers:\n\n${serverList}`);
  },
};
