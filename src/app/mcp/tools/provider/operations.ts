/**
 * Provider Tools
 *
 * MCP tools for managing Git provider accounts and Docker registry
 * accounts in Komodo.
 *
 * @module tools/provider/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

// ── Git Provider Account Tools ───────────────────────────────────────

export const listGitProviderAccountsTool: Tool = {
  name: 'komodo_list_git_provider_accounts',
  description: 'List configured Git provider accounts. Optionally filter by domain or username.',
  schema: z.object({
    domain: z.string().optional().describe('Filter by Git provider domain (e.g., "github.com")'),
    username: z.string().optional().describe('Filter by Git username'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_git_provider_accounts');
    const result = await wrapApiCall(
      'listGitProviderAccounts',
      () => validClient.providers.listGitProviderAccounts(args.domain, args.username, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Git provider accounts:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getGitProviderAccountTool: Tool = {
  name: 'komodo_get_git_provider_account',
  description: 'Get details of a specific Git provider account.',
  schema: z.object({
    id: z.string().describe('Git provider account ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_git_provider_account');
    const result = await wrapApiCall(
      'getGitProviderAccount',
      () => validClient.providers.getGitProviderAccount(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createGitProviderAccountTool: Tool = {
  name: 'komodo_create_git_provider_account',
  description: 'Create a new Git provider account for use in builds, repos, and syncs.',
  schema: z.object({
    domain: z.string().describe('Git provider domain (e.g., "github.com", "gitlab.com")'),
    username: z.string().describe('Git username'),
    token: z.string().describe('Authentication token (personal access token or similar)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_git_provider_account');
    const result = await wrapApiCall(
      'createGitProviderAccount',
      () =>
        validClient.providers.createGitProviderAccount(args.domain, args.username, args.token, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Git provider account created for "${args.username}@${args.domain}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const updateGitProviderAccountTool: Tool = {
  name: 'komodo_update_git_provider_account',
  description: 'Update an existing Git provider account. Only provided fields are updated.',
  schema: z.object({
    id: z.string().describe('Git provider account ID'),
    domain: z.string().optional().describe('New Git provider domain'),
    username: z.string().optional().describe('New Git username'),
    token: z.string().optional().describe('New authentication token'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_update_git_provider_account');
    const result = await wrapApiCall(
      'updateGitProviderAccount',
      () =>
        validClient.providers.updateGitProviderAccount(args.id, args.domain, args.username, args.token, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Git provider account "${args.id}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const deleteGitProviderAccountTool: Tool = {
  name: 'komodo_delete_git_provider_account',
  description: 'Delete a Git provider account. WARNING: Resources using this account may lose access.',
  schema: z.object({
    id: z.string().describe('Git provider account ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_git_provider_account');
    const result = await wrapApiCall(
      'deleteGitProviderAccount',
      () => validClient.providers.deleteGitProviderAccount(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Git provider account "${args.id}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

// ── Docker Registry Account Tools ────────────────────────────────────

export const listDockerRegistryAccountsTool: Tool = {
  name: 'komodo_list_docker_registry_accounts',
  description: 'List configured Docker registry accounts. Optionally filter by domain or username.',
  schema: z.object({
    domain: z.string().optional().describe('Filter by registry domain (e.g., "docker.io", "ghcr.io")'),
    username: z.string().optional().describe('Filter by registry username'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_docker_registry_accounts');
    const result = await wrapApiCall(
      'listDockerRegistryAccounts',
      () => validClient.providers.listDockerRegistryAccounts(args.domain, args.username, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Docker registry accounts:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getDockerRegistryAccountTool: Tool = {
  name: 'komodo_get_docker_registry_account',
  description: 'Get details of a specific Docker registry account.',
  schema: z.object({
    id: z.string().describe('Docker registry account ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_docker_registry_account');
    const result = await wrapApiCall(
      'getDockerRegistryAccount',
      () => validClient.providers.getDockerRegistryAccount(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createDockerRegistryAccountTool: Tool = {
  name: 'komodo_create_docker_registry_account',
  description: 'Create a new Docker registry account for pulling/pushing images.',
  schema: z.object({
    domain: z.string().describe('Registry domain (e.g., "docker.io", "ghcr.io", "registry.example.com")'),
    username: z.string().describe('Registry username'),
    password: z.string().describe('Registry password or token'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_docker_registry_account');
    const result = await wrapApiCall(
      'createDockerRegistryAccount',
      () =>
        validClient.providers.createDockerRegistryAccount(args.domain, args.username, args.password, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Docker registry account created for "${args.username}@${args.domain}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const updateDockerRegistryAccountTool: Tool = {
  name: 'komodo_update_docker_registry_account',
  description: 'Update an existing Docker registry account. Only provided fields are updated.',
  schema: z.object({
    id: z.string().describe('Docker registry account ID'),
    domain: z.string().optional().describe('New registry domain'),
    username: z.string().optional().describe('New registry username'),
    password: z.string().optional().describe('New registry password or token'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_update_docker_registry_account');
    const result = await wrapApiCall(
      'updateDockerRegistryAccount',
      () =>
        validClient.providers.updateDockerRegistryAccount(args.id, args.domain, args.username, args.password, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Docker registry account "${args.id}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const deleteDockerRegistryAccountTool: Tool = {
  name: 'komodo_delete_docker_registry_account',
  description: 'Delete a Docker registry account. WARNING: Resources using this account may lose image access.',
  schema: z.object({
    id: z.string().describe('Docker registry account ID'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_docker_registry_account');
    const result = await wrapApiCall(
      'deleteDockerRegistryAccount',
      () => validClient.providers.deleteDockerRegistryAccount(args.id, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Docker registry account "${args.id}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};
