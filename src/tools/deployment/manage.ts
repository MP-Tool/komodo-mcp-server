import { z } from 'zod';
import { Tool } from '../base.js';
import { ERROR_MESSAGES } from '../../config/constants.js';

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
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
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
  description:
    'Create a new deployment. The image can be specified as a simple string (e.g., "nginx:latest") or as an object with type and params.',
  schema: z.object({
    name: z.string().describe('Name of the deployment'),
    server_id: z.string().optional().describe('ID or name of the server to deploy to'),
    image: z
      .union([
        z.string().describe('Docker image to deploy (e.g., nginx:latest)'),
        z
          .object({
            type: z.string().optional(),
            params: z
              .object({
                image: z.string(),
              })
              .optional(),
          })
          .describe('Image configuration object'),
      ])
      .optional()
      .describe('Docker image - either a string like "nginx:latest" or an object with type/params'),
    config: z.record(z.any()).optional().describe('Additional deployment configuration (env, volumes, etc.)'),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    // Build the config object
    const deploymentConfig: Record<string, unknown> = {
      ...args.config,
    };

    if (args.server_id) {
      deploymentConfig.server_id = args.server_id;
    }

    // Handle image - can be string or object
    if (args.image) {
      if (typeof args.image === 'string') {
        // Simple string format: "nginx:latest"
        deploymentConfig.image = { type: 'Image', params: { image: args.image } };
      } else if (typeof args.image === 'object') {
        // Object format: { type: 'Image', params: { image: 'nginx:latest' } }
        deploymentConfig.image = args.image;
      }
    }

    const result = await client.deployments.create(args.name, deploymentConfig);
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.name}" created successfully.\n\nDeployment Name: ${result.name}\n\nFull Result:\n${JSON.stringify(result, null, 2)}`,
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
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
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
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);
    const result = await client.deployments.delete(args.deployment);
    return {
      content: [
        {
          type: 'text',
          text: `Deployment "${args.deployment}" deleted successfully.\n\nDeleted Deployment:\n${JSON.stringify(result, null, 2)}`,
        },
      ],
    };
  },
};
