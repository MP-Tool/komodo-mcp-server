import { z } from 'zod';
import { Tool } from '../base.js';
import { Types } from '../../../api/index.js';
import { requireClient, wrapApiCall } from '../utils.js';

type DeploymentListItem = Types.DeploymentListItem;

/**
 * Tool to list all deployments.
 */
export const listDeploymentsTool: Tool = {
  name: 'komodo_list_deployments',
  description:
    'List all Komodo-managed deployments. Deployments are single-container applications managed by Komodo. Shows deployment name, ID, and current state (running, stopped, etc.).',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_deployments');
    const deployments = await wrapApiCall(
      'list deployments',
      () => komodoClient.deployments.list({ signal: abortSignal }),
      abortSignal,
    );
    return {
      content: [
        {
          type: 'text',
          text: `🚢 Deployments:\n\n${
            deployments
              .map((d: DeploymentListItem) => `• ${d.name} (${d.id}) - State: ${d.info?.state || 'Unknown'}`)
              .join('\n') || 'No deployments found.'
          }`,
        },
      ],
    };
  },
};
