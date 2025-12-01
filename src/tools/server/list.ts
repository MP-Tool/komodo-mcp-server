import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoServer } from '../../api/komodo-client.js';

export const listServersTool: Tool = {
  name: 'komodo_list_servers',
  description: 'List all available servers',
  schema: z.object({}),
  handler: async (_args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const servers = await client.listServers();
    return {
      content: [{
        type: 'text',
        text: `🖥️ Available servers:\n\n${servers.map((s: KomodoServer) => {
          const version = s.info.version && s.info.version.toLowerCase() !== 'unknown' 
            ? s.info.version 
            : 'N/A';
          const region = s.info.region || '';
          const regionStr = region ? ` | Region: ${region}` : '';
          return `• ${s.name} (${s.id}) - Status: ${s.info.state} | Version: ${version}${regionStr}`;
        }).join('\n') || 'No servers found.'}`
      }]
    };
  }
};
