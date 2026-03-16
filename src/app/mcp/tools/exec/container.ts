import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to execute a command inside a container.
 */
export const execContainerTool: Tool = {
  name: 'komodo_container_exec',
  description:
    'Execute a command inside a running container on a server. Returns command output (stdout/stderr). ' +
    'Useful for debugging, running one-off commands, checking container state, or executing maintenance tasks.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
    command: z
      .string()
      .describe('The command to execute inside the container (e.g., "ls -la /app", "cat /etc/os-release")'),
    shell: z
      .string()
      .default('sh')
      .describe('Shell to use for command execution. Default: "sh". Use "bash" if available in the container.'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_container_exec');

    const result = await wrapApiCall(
      'containerExec',
      () =>
        validClient.exec.containerExec(args.server, args.container, args.shell, args.command, {
          signal: abortSignal,
        }),
      abortSignal,
    );

    return successResponse(
      `⚡ Exec in container "${args.container}" on server "${args.server}":\n` +
        `Command: ${args.command}\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
