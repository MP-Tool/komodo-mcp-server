/**
 * List Full Tools
 *
 * Tools for listing Komodo resources with full details.
 * Unlike standard list operations that return summary items,
 * these return complete resource objects including configuration.
 *
 * @module tools/resource-info/list-full
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to list all servers with full details.
 */
export const listFullServersTool: Tool = {
  name: 'komodo_list_full_servers',
  description: 'List all servers with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter servers'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_servers');
    const result = await wrapApiCall(
      'listFullServers',
      () => validClient.resourceInfo.listFull('Servers', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Servers List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all deployments with full details.
 */
export const listFullDeploymentsTool: Tool = {
  name: 'komodo_list_full_deployments',
  description: 'List all deployments with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter deployments'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_deployments');
    const result = await wrapApiCall(
      'listFullDeployments',
      () => validClient.resourceInfo.listFull('Deployments', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Deployments List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all stacks with full details.
 */
export const listFullStacksTool: Tool = {
  name: 'komodo_list_full_stacks',
  description: 'List all stacks with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter stacks'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_stacks');
    const result = await wrapApiCall(
      'listFullStacks',
      () => validClient.resourceInfo.listFull('Stacks', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Stacks List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all builds with full details.
 */
export const listFullBuildsTool: Tool = {
  name: 'komodo_list_full_builds',
  description: 'List all builds with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter builds'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_builds');
    const result = await wrapApiCall(
      'listFullBuilds',
      () => validClient.resourceInfo.listFull('Builds', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Builds List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all builders with full details.
 */
export const listFullBuildersTool: Tool = {
  name: 'komodo_list_full_builders',
  description: 'List all builders with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter builders'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_builders');
    const result = await wrapApiCall(
      'listFullBuilders',
      () => validClient.resourceInfo.listFull('Builders', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Builders List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all repos with full details.
 */
export const listFullReposTool: Tool = {
  name: 'komodo_list_full_repos',
  description: 'List all repos with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter repos'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_repos');
    const result = await wrapApiCall(
      'listFullRepos',
      () => validClient.resourceInfo.listFull('Repos', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Repos List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all resource syncs with full details.
 */
export const listFullResourceSyncsTool: Tool = {
  name: 'komodo_list_full_resource_syncs',
  description: 'List all resource syncs with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter resource syncs'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_resource_syncs');
    const result = await wrapApiCall(
      'listFullResourceSyncs',
      () => validClient.resourceInfo.listFull('ResourceSyncs', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Resource Syncs List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all actions with full details.
 */
export const listFullActionsTool: Tool = {
  name: 'komodo_list_full_actions',
  description: 'List all actions with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter actions'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_actions');
    const result = await wrapApiCall(
      'listFullActions',
      () => validClient.resourceInfo.listFull('Actions', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Actions List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all procedures with full details.
 */
export const listFullProceduresTool: Tool = {
  name: 'komodo_list_full_procedures',
  description: 'List all procedures with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter procedures'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_procedures');
    const result = await wrapApiCall(
      'listFullProcedures',
      () => validClient.resourceInfo.listFull('Procedures', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Procedures List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to list all alerters with full details.
 */
export const listFullAlertersTool: Tool = {
  name: 'komodo_list_full_alerters',
  description: 'List all alerters with full configuration details. Optionally filter by a search query.',
  schema: z.object({
    query: z.string().optional().describe('Optional search query to filter alerters'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_full_alerters');
    const result = await wrapApiCall(
      'listFullAlerters',
      () => validClient.resourceInfo.listFull('Alerters', args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Full Alerters List:\n\n${JSON.stringify(result, null, 2)}`);
  },
};
