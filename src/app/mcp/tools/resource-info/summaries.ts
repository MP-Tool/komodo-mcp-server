/**
 * Summary Tools
 *
 * Tools for getting summary overviews of Komodo resource types.
 * Summaries provide aggregate counts and status breakdowns
 * without returning full resource details.
 *
 * @module tools/resource-info/summaries
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

/**
 * Tool to get a summary of all deployments.
 */
export const getDeploymentsSummaryTool: Tool = {
  name: 'komodo_get_deployments_summary',
  description:
    'Get a summary overview of all deployments including status counts, health breakdown, and resource totals.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_deployments_summary');
    const result = await wrapApiCall(
      'getDeploymentsSummary',
      () => validClient.resourceInfo.getSummary('Deployments', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Deployments Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all stacks.
 */
export const getStacksSummaryTool: Tool = {
  name: 'komodo_get_stacks_summary',
  description: 'Get a summary overview of all stacks including status counts, health breakdown, and resource totals.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_stacks_summary');
    const result = await wrapApiCall(
      'getStacksSummary',
      () => validClient.resourceInfo.getSummary('Stacks', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Stacks Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all builds.
 */
export const getBuildsSummaryTool: Tool = {
  name: 'komodo_get_builds_summary',
  description: 'Get a summary overview of all builds including status counts and build statistics.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_builds_summary');
    const result = await wrapApiCall(
      'getBuildsSummary',
      () => validClient.resourceInfo.getSummary('Builds', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Builds Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all builders.
 */
export const getBuildersSummaryTool: Tool = {
  name: 'komodo_get_builders_summary',
  description: 'Get a summary overview of all builders including availability and configuration status.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_builders_summary');
    const result = await wrapApiCall(
      'getBuildersSummary',
      () => validClient.resourceInfo.getSummary('Builders', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Builders Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all repos.
 */
export const getReposSummaryTool: Tool = {
  name: 'komodo_get_repos_summary',
  description: 'Get a summary overview of all repos including clone status and sync state.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_repos_summary');
    const result = await wrapApiCall(
      'getReposSummary',
      () => validClient.resourceInfo.getSummary('Repos', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repos Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all resource syncs.
 */
export const getResourceSyncsSummaryTool: Tool = {
  name: 'komodo_get_resource_syncs_summary',
  description: 'Get a summary overview of all resource syncs including sync status and pending changes.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_resource_syncs_summary');
    const result = await wrapApiCall(
      'getResourceSyncsSummary',
      () => validClient.resourceInfo.getSummary('ResourceSyncs', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Resource Syncs Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all actions.
 */
export const getActionsSummaryTool: Tool = {
  name: 'komodo_get_actions_summary',
  description: 'Get a summary overview of all actions including execution status and run counts.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_actions_summary');
    const result = await wrapApiCall(
      'getActionsSummary',
      () => validClient.resourceInfo.getSummary('Actions', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Actions Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all procedures.
 */
export const getProceduresSummaryTool: Tool = {
  name: 'komodo_get_procedures_summary',
  description: 'Get a summary overview of all procedures including execution status and run counts.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_procedures_summary');
    const result = await wrapApiCall(
      'getProceduresSummary',
      () => validClient.resourceInfo.getSummary('Procedures', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Procedures Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

/**
 * Tool to get a summary of all alerters.
 */
export const getAlertersSummaryTool: Tool = {
  name: 'komodo_get_alerters_summary',
  description: 'Get a summary overview of all alerters including enabled status and alert counts.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_alerters_summary');
    const result = await wrapApiCall(
      'getAlertersSummary',
      () => validClient.resourceInfo.getSummary('Alerters', { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Alerters Summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};
