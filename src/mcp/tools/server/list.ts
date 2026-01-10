import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoServerListItem } from '../../../api/index.js';
import { requireClient, wrapApiCall } from '../utils.js';

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
      'list servers',
      () => komodoClient.servers.list({ signal: abortSignal }),
      abortSignal,
    );
    return {
      content: [
        {
          type: 'text',
          text: `🖥️ Available servers:\n\n${
            servers
              .map((s: KomodoServerListItem) => {
                const version = s.info.version && s.info.version.toLowerCase() !== 'unknown' ? s.info.version : 'N/A';
                const region = s.info.region || '';
                const regionStr = region ? ` | Region: ${region}` : '';
                return `• ${s.name} (${s.id}) - Status: ${s.info.state} | Version: ${version}${regionStr}`;
              })
              .join('\n') || 'No servers found.'
          }`,
        },
      ],
    };
  },
};
