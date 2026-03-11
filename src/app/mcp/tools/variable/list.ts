import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listVariablesTool: Tool = {
  name: 'komodo_list_variables',
  description: 'List all variables in Komodo. Variables are key-value pairs used for configuration templating.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_variables');
    const variables = await wrapApiCall(
      'listVariables',
      () => komodoClient.variables.list({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📋 Variables:\n\n${JSON.stringify(variables, null, 2)}`);
  },
};

export const listTagsTool: Tool = {
  name: 'komodo_list_tags',
  description: 'List all tags in Komodo. Tags are used to organize and filter resources.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_tags');
    const tags = await wrapApiCall(
      'listTags',
      () => komodoClient.tags.list({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`📋 Tags:\n\n${JSON.stringify(tags, null, 2)}`);
  },
};
