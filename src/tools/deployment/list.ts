import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoDeployment } from '../../api/komodo-client.js';

export const listDeploymentsTool: Tool = {
  name: 'komodo_list_deployments',
  description: 'List all deployments',
  schema: z.object({}),
  handler: async (_args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const deployments = await client.listDeployments();
    return {
      content: [{
        type: 'text',
        text: `🚢 Deployments:\n\n${deployments.map((d: KomodoDeployment) => 
          `• ${d.name} (${d.id}) - State: ${d.state || 'Unknown'}`
        ).join('\n') || 'No deployments found.'}`
      }]
    };
  }
};
