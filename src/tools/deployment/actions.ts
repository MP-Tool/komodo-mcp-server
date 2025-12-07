import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/utils.js';

export const deployContainerTool: Tool = {
  name: 'komodo_deploy_container',
  description: 'Deploy a container',
  schema: z.object({
    deployment: z.string().describe('Deployment ID or name')
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.deployments.deploy(args.deployment);
    return {
      content: [{
        type: 'text',
        text: `🚀 Deployment "${args.deployment}" started.\n\nUpdate ID: ${extractUpdateId(result)}\nStatus: ${result.status}`
      }]
    };
  }
};
