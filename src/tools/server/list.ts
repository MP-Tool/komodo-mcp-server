import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoServerListItem } from '../../api/index.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

/**
 * Tool to list all available servers.
 */
export const listServersTool: Tool = {
  name: 'komodo_list_servers',
  description:
    'List all servers registered in Komodo. Shows server name, ID, status (healthy/unhealthy/disabled), Periphery version, and region. Use this to discover available servers before performing container or deployment operations.',
  schema: z.object({}),
  handler: async (_args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const servers = await client.servers.list();
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
