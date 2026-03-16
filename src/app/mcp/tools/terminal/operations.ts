import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to list terminal sessions on a server.
 */
export const listTerminalsTool: Tool = {
  name: 'komodo_list_terminals',
  description:
    'List terminal sessions on a server. Returns all active terminal sessions. ' +
    'Use fresh=true to bypass cache and get the latest state.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    fresh: z.boolean().optional().describe('Force a fresh query, bypassing any cached results. Default: false'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_terminals');

    const result = await wrapApiCall(
      'listTerminals',
      () => validClient.terminals.list(args.server, args.fresh, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(`📋 Terminal sessions on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to create a terminal session on a server.
 */
export const createTerminalTool: Tool = {
  name: 'komodo_create_terminal',
  description:
    'Create a new terminal session on a server. Optionally specify a command to run ' +
    'and whether to recreate an existing terminal with the same name.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    name: z.string().describe('Name for the terminal session'),
    command: z.string().optional().describe('Command to run in the terminal session'),
    recreate: z
      .boolean()
      .optional()
      .describe('Whether to recreate the terminal if one with the same name already exists. Default: false'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_terminal');

    const result = await wrapApiCall(
      'createTerminal',
      () =>
        validClient.terminals.create(args.server, args.name, args.command, args.recreate, {
          signal: abortSignal,
        }),
      abortSignal,
    );

    return successResponse(
      `✨ Terminal "${args.name}" created on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

/**
 * Tool to delete a terminal session on a server.
 */
export const deleteTerminalTool: Tool = {
  name: 'komodo_delete_terminal',
  description: 'Delete a specific terminal session on a server.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    terminal: z.string().describe('Name or ID of the terminal session to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_terminal');

    const result = await wrapApiCall(
      'deleteTerminal',
      () => validClient.terminals.delete(args.server, args.terminal, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `🗑️ Terminal "${args.terminal}" deleted from server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

/**
 * Tool to delete all terminal sessions on a server.
 */
export const deleteAllTerminalsTool: Tool = {
  name: 'komodo_delete_all_terminals',
  description:
    'Delete all terminal sessions on a server. Use with caution as this removes every active terminal session.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_all_terminals');

    const result = await wrapApiCall(
      'deleteAllTerminals',
      () => validClient.terminals.deleteAll(args.server, { signal: abortSignal }),
      abortSignal,
    );

    return successResponse(
      `🗑️ All terminals deleted from server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
