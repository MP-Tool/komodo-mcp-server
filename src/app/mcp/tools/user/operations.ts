/**
 * User Management Tools
 *
 * MCP tools for managing Komodo users including listing, finding,
 * creating service accounts, and updating user properties.
 *
 * @module mcp/tools/user/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listUsersTool: Tool = {
  name: 'komodo_list_users',
  description: 'List all users in Komodo.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_users');
    const users = await wrapApiCall('listUsers', () => komodoClient.users.list({ signal: abortSignal }), abortSignal);
    return successResponse(`Users:\n\n${JSON.stringify(users, null, 2)}`);
  },
};

export const findUserTool: Tool = {
  name: 'komodo_find_user',
  description: 'Find a user by username or ID.',
  schema: z.object({
    user: z.string().describe('Username or user ID to find'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_find_user');
    const result = await wrapApiCall(
      'findUser',
      () => komodoClient.users.find(args.user, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const getUsernameTool: Tool = {
  name: 'komodo_get_username',
  description: 'Get the username for a given user ID.',
  schema: z.object({
    user_id: z.string().describe('User ID to look up'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_username');
    const result = await wrapApiCall(
      'getUsername',
      () => komodoClient.users.getUsername(args.user_id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createServiceUserTool: Tool = {
  name: 'komodo_create_service_user',
  description: 'Create a new service user (service account) in Komodo.',
  schema: z.object({
    username: z.string().describe('Username for the service account'),
    description: z.string().optional().describe('Optional description for the service user'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_service_user');
    const result = await wrapApiCall(
      'createServiceUser',
      () => komodoClient.users.createServiceUser(args.username, args.description, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Service user "${args.username}" created successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const deleteUserTool: Tool = {
  name: 'komodo_delete_user',
  description: 'Delete a user by ID.',
  schema: z.object({
    id: z.string().describe('User ID to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_user');
    const result = await wrapApiCall(
      'deleteUser',
      () => komodoClient.users.delete(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`User "${args.id}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateUsernameTool: Tool = {
  name: 'komodo_update_username',
  description: "Update a user's username.",
  schema: z.object({
    id: z.string().describe('User ID'),
    username: z.string().describe('New username'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_username');
    const result = await wrapApiCall(
      'updateUserUsername',
      () => komodoClient.users.updateUsername(args.id, args.username, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Username updated to "${args.username}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const updateUserPasswordTool: Tool = {
  name: 'komodo_update_user_password',
  description: "Update a user's password.",
  schema: z.object({
    id: z.string().describe('User ID'),
    password: z.string().describe('New password'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_user_password');
    const result = await wrapApiCall(
      'updateUserPassword',
      () => komodoClient.users.updatePassword(args.id, args.password, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`User password updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateServiceUserDescriptionTool: Tool = {
  name: 'komodo_update_service_user_description',
  description: 'Update the description of a service user.',
  schema: z.object({
    id: z.string().describe('Service user ID'),
    description: z.string().describe('New description'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_service_user_description');
    const result = await wrapApiCall(
      'updateServiceUserDescription',
      () => komodoClient.users.updateServiceUserDescription(args.id, args.description, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Service user description updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateUserAdminTool: Tool = {
  name: 'komodo_update_user_admin',
  description: 'Toggle admin status for a user.',
  schema: z.object({
    user_id: z.string().describe('User ID'),
    admin: z.boolean().describe('Whether the user should be an admin'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_user_admin');
    const result = await wrapApiCall(
      'updateUserAdmin',
      () => komodoClient.users.updateAdmin(args.user_id, args.admin, { signal: abortSignal }),
      abortSignal,
    );
    const status = args.admin ? 'granted' : 'revoked';
    return successResponse(`Admin status ${status} successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};
