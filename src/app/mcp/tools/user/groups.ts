/**
 * User Group Management Tools
 *
 * MCP tools for managing Komodo user groups including listing,
 * creating, renaming, deleting, and managing group membership.
 *
 * @module mcp/tools/user/groups
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listUserGroupsTool: Tool = {
  name: 'komodo_list_user_groups',
  description: 'List all user groups in Komodo.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_user_groups');
    const groups = await wrapApiCall(
      'listUserGroups',
      () => komodoClient.users.listGroups({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`User Groups:\n\n${JSON.stringify(groups, null, 2)}`);
  },
};

export const getUserGroupTool: Tool = {
  name: 'komodo_get_user_group',
  description: 'Get detailed information about a specific user group.',
  schema: z.object({
    user_group: z.string().describe('User group name or ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_user_group');
    const result = await wrapApiCall(
      'getUserGroup',
      () => komodoClient.users.getGroup(args.user_group, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createUserGroupTool: Tool = {
  name: 'komodo_create_user_group',
  description: 'Create a new user group.',
  schema: z.object({
    name: z.string().describe('Name for the new user group'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_user_group');
    const result = await wrapApiCall(
      'createUserGroup',
      () => komodoClient.users.createGroup(args.name, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`User group "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const renameUserGroupTool: Tool = {
  name: 'komodo_rename_user_group',
  description: 'Rename an existing user group.',
  schema: z.object({
    id: z.string().describe('User group ID'),
    name: z.string().describe('New name for the user group'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_rename_user_group');
    const result = await wrapApiCall(
      'renameUserGroup',
      () => komodoClient.users.renameGroup(args.id, args.name, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`User group renamed to "${args.name}" successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteUserGroupTool: Tool = {
  name: 'komodo_delete_user_group',
  description: 'Delete a user group.',
  schema: z.object({
    id: z.string().describe('User group ID to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_user_group');
    const result = await wrapApiCall(
      'deleteUserGroup',
      () => komodoClient.users.deleteGroup(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`User group deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const addUserToUserGroupTool: Tool = {
  name: 'komodo_add_user_to_user_group',
  description: 'Add a user to a user group.',
  schema: z.object({
    user_group: z.string().describe('User group name or ID'),
    user: z.string().describe('User name or ID to add to the group'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_add_user_to_user_group');
    const result = await wrapApiCall(
      'addUserToUserGroup',
      () => komodoClient.users.addUserToGroup(args.user_group, args.user, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `User "${args.user}" added to group "${args.user_group}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const removeUserFromUserGroupTool: Tool = {
  name: 'komodo_remove_user_from_user_group',
  description: 'Remove a user from a user group.',
  schema: z.object({
    user_group: z.string().describe('User group name or ID'),
    user: z.string().describe('User name or ID to remove from the group'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_remove_user_from_user_group');
    const result = await wrapApiCall(
      'removeUserFromUserGroup',
      () => komodoClient.users.removeUserFromGroup(args.user_group, args.user, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `User "${args.user}" removed from group "${args.user_group}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
