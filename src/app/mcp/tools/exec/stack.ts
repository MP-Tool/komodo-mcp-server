import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to execute a command inside a stack service container.
 */
export const execStackTool: Tool = {
  name: 'komodo_stack_exec',
  description:
    "Execute a command inside a stack service's running container. Returns command output (stdout/stderr). " +
    'Specify both the stack and the service name within the stack.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    service: z.string().describe('Service name within the stack to exec into'),
    command: z.string().describe('The command to execute inside the service container'),
    shell: z
      .string()
      .default('sh')
      .describe('Shell to use for command execution. Default: "sh". Use "bash" if available.'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_stack_exec');

    const result = await wrapApiCall(
      'stackExec',
      () =>
        validClient.exec.stackExec(args.stack, args.service, args.shell, args.command, {
          signal: abortSignal,
        }),
      abortSignal,
    );

    return successResponse(
      `⚡ Exec in stack "${args.stack}" service "${args.service}":\n` +
        `Command: ${args.command}\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
