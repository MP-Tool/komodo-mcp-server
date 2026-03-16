import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS, LOG_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listStackServicesTool: Tool = {
  name: 'komodo_list_stack_services',
  description: 'List all services defined in a stack with their current status.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_stack_services');
    const result = await wrapApiCall(
      'listStackServices',
      () => validClient.stackAdvanced.listServices(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📚 Services in stack "${args.stack}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getStackLogTool: Tool = {
  name: 'komodo_get_stack_log',
  description: 'Get logs from stack services. Specify which services to get logs from.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    services: z.array(z.string()).describe('List of service names to get logs from'),
    tail: z.number().optional().describe(LOG_DESCRIPTIONS.TAIL_LINES(100)),
    timestamps: z.boolean().optional().describe(LOG_DESCRIPTIONS.TIMESTAMPS(false)),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_stack_log');
    const result = await wrapApiCall(
      'getStackLog',
      () =>
        validClient.stackAdvanced.getLog(args.stack, args.services, args.tail, args.timestamps, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `📋 Logs for stack "${args.stack}" services [${args.services.join(', ')}]:\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const searchStackLogTool: Tool = {
  name: 'komodo_search_stack_log',
  description: 'Search logs from stack services for specific terms.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    services: z.array(z.string()).describe('List of service names to search logs from'),
    terms: z.array(z.string()).describe('Search terms to look for in logs'),
    combinator: z.enum(['And', 'Or']).optional().describe('How to combine search terms. Default: "Or"'),
    invert: z.boolean().optional().describe('Invert search to show non-matching lines'),
    timestamps: z.boolean().optional().describe(LOG_DESCRIPTIONS.TIMESTAMPS(false)),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_search_stack_log');
    const result = await wrapApiCall(
      'searchStackLog',
      () =>
        validClient.stackAdvanced.searchLog(
          args.stack,
          args.services,
          args.terms,
          args.combinator,
          args.invert,
          args.timestamps,
          { signal: abortSignal },
        ),
      abortSignal,
    );
    return successResponse(`🔍 Search results in stack "${args.stack}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getStackWebhooksEnabledTool: Tool = {
  name: 'komodo_get_stack_webhooks_enabled',
  description: 'Check if webhooks are enabled for a stack.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_stack_webhooks_enabled');
    const result = await wrapApiCall(
      'getStackWebhooksEnabled',
      () => validClient.stackAdvanced.getWebhooksEnabled(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`🔗 Webhooks status for stack "${args.stack}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deployStackIfChangedTool: Tool = {
  name: 'komodo_deploy_stack_if_changed',
  description:
    'Deploy a stack only if the compose file has changed since last deployment. Avoids unnecessary restarts.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    stop_time: z.number().optional().describe('Seconds to wait for graceful stop during redeploy'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_deploy_stack_if_changed');
    const result = await wrapApiCall(
      'deployStackIfChanged',
      () => validClient.stackAdvanced.deployIfChanged(args.stack, args.stop_time, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📤 Deploy-if-changed for stack "${args.stack}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const runStackServiceTool: Tool = {
  name: 'komodo_run_stack_service',
  description:
    'Run a one-off command in a stack service container (equivalent to "docker compose run"). Creates a new container for the command.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    service: z.string().describe('Service name within the stack to run the command in'),
    command: z.string().optional().describe('Command to run (overrides default service command)'),
    detach: z.boolean().optional().describe('Run in background (detached mode)'),
    env: z.string().optional().describe('Environment variables as KEY=VALUE pairs separated by newlines'),
    workdir: z.string().optional().describe('Working directory inside the container'),
    user: z.string().optional().describe('User to run the command as (e.g., "root", "1000:1000")'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_run_stack_service');
    const result = await wrapApiCall(
      'runStackService',
      () =>
        validClient.stackAdvanced.runService(
          args.stack,
          args.service,
          args.command,
          args.detach,
          args.env,
          args.workdir,
          args.user,
          { signal: abortSignal },
        ),
      abortSignal,
    );
    return successResponse(
      `🚀 Run service "${args.service}" in stack "${args.stack}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
