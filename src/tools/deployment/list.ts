import { z } from 'zod';
import { Tool } from '../base.js';
import { KomodoDeploymentListItem } from '../../api/index.js';

/**
 * Tool to list all deployments.
 */
export const listDeploymentsTool: Tool = {
  name: 'komodo_list_deployments',
  description: 'List all deployments',
  schema: z.object({}),
  handler: async (_args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const deployments = await client.deployments.list();
    return {
      content: [
        {
          type: 'text',
          text: `🚢 Deployments:\n\n${
            deployments
              .map((d: KomodoDeploymentListItem) => `• ${d.name} (${d.id}) - State: ${d.info.state || 'Unknown'}`)
              .join('\n') || 'No deployments found.'
          }`,
        },
      ],
    };
  },
};
