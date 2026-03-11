import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const getVariableTool: Tool = {
  name: 'komodo_get_variable',
  description: 'Get detailed information about a specific variable.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.VARIABLE_NAME),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_variable');
    const result = await wrapApiCall(
      'getVariable',
      () => komodoClient.variables.get(args.name, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createVariableTool: Tool = {
  name: 'komodo_create_variable',
  description: 'Create a new variable for configuration templating.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.VARIABLE_NAME),
    value: z.string().describe('Variable value'),
    description: z.string().optional().describe('Optional description of the variable'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_variable');
    const result = await wrapApiCall(
      'createVariable',
      () => komodoClient.variables.create(args.name, args.value, args.description, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Variable "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateVariableValueTool: Tool = {
  name: 'komodo_update_variable_value',
  description: 'Update the value of an existing variable.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.VARIABLE_NAME),
    value: z.string().describe('New variable value'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_variable_value');
    const result = await wrapApiCall(
      'updateVariableValue',
      () => komodoClient.variables.updateValue(args.name, args.value, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Variable "${args.name}" value updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateVariableDescriptionTool: Tool = {
  name: 'komodo_update_variable_description',
  description: 'Update the description of an existing variable.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.VARIABLE_NAME),
    description: z.string().describe('New variable description'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_variable_description');
    const result = await wrapApiCall(
      'updateVariableDescription',
      () => komodoClient.variables.updateDescription(args.name, args.description, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Variable "${args.name}" description updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteVariableTool: Tool = {
  name: 'komodo_delete_variable',
  description: 'Delete a variable.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.VARIABLE_NAME),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_variable');
    const result = await wrapApiCall(
      'deleteVariable',
      () => komodoClient.variables.delete(args.name, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Variable "${args.name}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getTagTool: Tool = {
  name: 'komodo_get_tag',
  description: 'Get detailed information about a specific tag.',
  schema: z.object({
    tag: z.string().describe(PARAM_DESCRIPTIONS.TAG_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_tag');
    const result = await wrapApiCall(
      'getTag',
      () => komodoClient.tags.get(args.tag, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createTagTool: Tool = {
  name: 'komodo_create_tag',
  description: 'Create a new tag for organizing resources.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.TAG_NAME),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_tag');
    const result = await wrapApiCall(
      'createTag',
      () => komodoClient.tags.create(args.name, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Tag "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteTagTool: Tool = {
  name: 'komodo_delete_tag',
  description: 'Delete a tag.',
  schema: z.object({
    tag: z.string().describe(PARAM_DESCRIPTIONS.TAG_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_tag');
    const result = await wrapApiCall(
      'deleteTag',
      () => komodoClient.tags.delete(args.tag, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Tag "${args.tag}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const renameTagTool: Tool = {
  name: 'komodo_rename_tag',
  description: 'Rename an existing tag.',
  schema: z.object({
    tag: z.string().describe(PARAM_DESCRIPTIONS.TAG_ID),
    name: z.string().describe('New name for the tag'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_rename_tag');
    const result = await wrapApiCall(
      'renameTag',
      () => komodoClient.tags.rename(args.tag, args.name, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Tag renamed to "${args.name}" successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};
