import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to execute a command inside a deployment's container.
 */
export const execDeploymentTool: Tool = {
  name: 'komodo_deployment_exec',
  description:
    "Execute a command inside a deployment's running container. Returns command output (stdout/stderr). " +
    'Useful for debugging deployments without needing to know the underlying server or container name.',
  schema: z.object({
    deployment: z.string().describe(PARAM_DESCRIPTIONS.DEPLOYMENT_ID),
    command: z.string().describe('The command to execute inside the deployment container'),
    shell: z
      .string()
      .default('sh')
      .describe('Shell to use for command execution. Default: "sh". Use "bash" if available.'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_deployment_exec');

    const result = await wrapApiCall(
      'deploymentExec',
      () =>
        validClient.exec.deploymentExec(args.deployment, args.shell, args.command, {
          signal: abortSignal,
        }),
      abortSignal,
    );

    return successResponse(
      `⚡ Exec in deployment "${args.deployment}":\n` +
        `Command: ${args.command}\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
