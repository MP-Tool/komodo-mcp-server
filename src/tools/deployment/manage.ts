import { z } from 'zod';
import { Tool } from '../base.js';
import { extractUpdateId } from '../../api/index.js';

/**
 * Tool to get detailed information about a deployment.
 */
export const getDeploymentInfoTool: Tool = {
  name: 'komodo_get_deployment_info',
  description: 'Get detailed information about a specific deployment',
  schema: z.object({
    deployment: z.string().describe('Deployment ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.deployments.get(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  },
};

/**
 * Tool to create a new deployment.
 */
export const createDeploymentTool: Tool = {
  name: 'komodo_create_deployment',
  description: 'Create a new deployment',
  schema: z.object({
    name: z.string().describe('Name of the deployment'),
    server_id: z.string().describe('ID of the server to deploy to'),
    image: z.record(z.any()).describe('Image configuration'),
    config: z.record(z.any()).optional().describe('Additional deployment configuration (env, volumes, etc.)'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.deployments.create({
      name: args.name,
      server_id: args.server_id,
      image: args.image,
      ...args.config,
    });
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.name}" created successfully.\n\nResult: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to update a deployment.
 */
export const updateDeploymentTool: Tool = {
  name: 'komodo_update_deployment',
  description: 'Update an existing deployment configuration',
  schema: z.object({
    deployment: z.string().describe('Deployment ID or name'),
    config: z.record(z.any()).describe('New deployment configuration'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    const result = await client.deployments.update(args.deployment, args.config);
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.deployment}" updated successfully.\n\nResult: ${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};

/**
 * Tool to delete a deployment.
 */
export const deleteDeploymentTool: Tool = {
  name: 'komodo_delete_deployment',
  description: 'Delete a deployment',
  schema: z.object({
    deployment: z.string().describe('Deployment ID or name'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error('Komodo client not initialized');
    await client.deployments.delete(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.deployment}" deleted successfully.`,
        },
      ],
    };
  },
};
