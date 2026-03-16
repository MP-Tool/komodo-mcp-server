/**
 * Permission and API Key Management Tools
 *
 * MCP tools for managing Komodo permissions on resources and
 * API key lifecycle for service users.
 *
 * @module mcp/tools/permission/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

// ============================================================================
// Permission Tools
// ============================================================================

export const listPermissionsTool: Tool = {
  name: 'komodo_list_permissions',
  description: 'List all permissions in Komodo.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_permissions');
    const permissions = await wrapApiCall(
      'listPermissions',
      () => komodoClient.permissions.list({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Permissions:\n\n${JSON.stringify(permissions, null, 2)}`);
  },
};

export const getPermissionTool: Tool = {
  name: 'komodo_get_permission',
  description: 'Get permissions for a specific target resource.',
  schema: z.object({
    target: z
      .object({
        type: z
          .string()
          .describe(
            'Resource type (e.g., "Server", "Stack", "Deployment", "Build", "Repo", "Action", "Procedure", "Alerter", "Builder", "ServerTemplate")',
          ),
        id: z.string().describe('Resource ID'),
      })
      .describe('Target resource to get permissions for'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_permission');
    const result = await wrapApiCall(
      'getPermission',
      () => komodoClient.permissions.getPermission(args.target, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const listUserTargetPermissionsTool: Tool = {
  name: 'komodo_list_user_target_permissions',
  description: 'List permissions that a specific user or user group has on targets.',
  schema: z.object({
    user_target: z
      .object({
        type: z.string().describe('Target type: "User" or "UserGroup"'),
        id: z.string().describe('User ID or User Group ID'),
      })
      .describe('The user or user group to list permissions for'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_user_target_permissions');
    const result = await wrapApiCall(
      'listUserTargetPermissions',
      () =>
        komodoClient.permissions.listUserTargetPermissions({ user_target: args.user_target }, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const updatePermissionOnTargetTool: Tool = {
  name: 'komodo_update_permission',
  description: 'Update a permission on a specific target for a user or group.',
  schema: z.object({
    user_target: z
      .object({
        type: z.string().describe('Target type: "User" or "UserGroup"'),
        id: z.string().describe('User ID or User Group ID'),
      })
      .describe('The user or user group to set the permission for'),
    permission: z.string().describe('Permission name (e.g., "Read", "Execute", "Write")'),
    level: z.string().describe('Permission level (e.g., "None", "Read", "Execute", "Write")'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_permission');
    const result = await wrapApiCall(
      'updatePermissionOnTarget',
      () =>
        komodoClient.permissions.updatePermissionOnTarget(args.user_target, args.permission, args.level, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Permission "${args.permission}" set to "${args.level}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const updateUserBasePermissionsTool: Tool = {
  name: 'komodo_update_user_base_permissions',
  description: 'Toggle base permissions for a user (enable or disable).',
  schema: z.object({
    user_id: z.string().describe('User ID'),
    enabled: z.boolean().describe('Whether base permissions should be enabled'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_user_base_permissions');
    const result = await wrapApiCall(
      'updateUserBasePermissions',
      () => komodoClient.permissions.updateUserBasePermissions(args.user_id, args.enabled, { signal: abortSignal }),
      abortSignal,
    );
    const status = args.enabled ? 'enabled' : 'disabled';
    return successResponse(`Base permissions ${status} successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ============================================================================
// API Key Tools
// ============================================================================

export const listApiKeysTool: Tool = {
  name: 'komodo_list_api_keys',
  description: 'List all API keys in Komodo.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_api_keys');
    const keys = await wrapApiCall(
      'listApiKeys',
      () => komodoClient.permissions.listApiKeys({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`API Keys:\n\n${JSON.stringify(keys, null, 2)}`);
  },
};

export const listApiKeysForServiceUserTool: Tool = {
  name: 'komodo_list_api_keys_for_service_user',
  description: 'List API keys for a specific service user.',
  schema: z.object({
    user: z.string().describe('Service user name or ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_api_keys_for_service_user');
    const keys = await wrapApiCall(
      'listApiKeysForServiceUser',
      () => komodoClient.permissions.listApiKeysForServiceUser(args.user, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`API Keys for "${args.user}":\n\n${JSON.stringify(keys, null, 2)}`);
  },
};

export const createApiKeyForServiceUserTool: Tool = {
  name: 'komodo_create_api_key_for_service_user',
  description: 'Create a new API key for a service user. The secret is only returned once upon creation.',
  schema: z.object({
    user: z.string().describe('Service user name or ID'),
    name: z.string().describe('Name for the API key'),
    expires: z.string().optional().describe('Optional expiration timestamp (ISO 8601 format)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_api_key_for_service_user');
    const result = await wrapApiCall(
      'createApiKeyForServiceUser',
      () =>
        komodoClient.permissions.createApiKeyForServiceUser(args.user, args.name, args.expires, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `API key "${args.name}" created for user "${args.user}". Save the secret now - it won't be shown again.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const deleteApiKeyForServiceUserTool: Tool = {
  name: 'komodo_delete_api_key_for_service_user',
  description: 'Delete an API key for a service user.',
  schema: z.object({
    user: z.string().describe('Service user name or ID'),
    key: z.string().describe('API key ID to delete'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_api_key_for_service_user');
    const result = await wrapApiCall(
      'deleteApiKeyForServiceUser',
      () => komodoClient.permissions.deleteApiKeyForServiceUser(args.user, args.key, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `API key deleted for user "${args.user}" successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
