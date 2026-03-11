import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { extractUpdateId } from '../../../api/utils.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import { formatActionResponse } from '../../../utils/index.js';

export const getRepoTool: Tool = {
  name: 'komodo_get_repo',
  description: 'Get detailed information about a specific repo.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_repo');
    const result = await wrapApiCall(
      'getRepo',
      () => komodoClient.repos.get(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createRepoTool: Tool = {
  name: 'komodo_create_repo',
  description: 'Create a new repo in Komodo for managing a git repository.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.REPO_NAME),
    config: z.record(z.unknown()).optional().describe('Repo configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_repo');
    const result = await wrapApiCall(
      'createRepo',
      () => komodoClient.repos.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repo "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateRepoTool: Tool = {
  name: 'komodo_update_repo',
  description: 'Update an existing repo configuration (PATCH-style).',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
    config: z.record(z.unknown()).describe('Repo configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_repo');
    const result = await wrapApiCall(
      'updateRepo',
      () => komodoClient.repos.update(args.repo, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repo "${args.repo}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteRepoTool: Tool = {
  name: 'komodo_delete_repo',
  description: 'Delete a repo from Komodo.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_repo');
    const result = await wrapApiCall(
      'deleteRepo',
      () => komodoClient.repos.delete(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repo "${args.repo}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const cloneRepoTool: Tool = {
  name: 'komodo_clone_repo',
  description: 'Clone a repo. Downloads the git repository to the configured location on the server.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_clone_repo');
    const result = await wrapApiCall(
      `clone repo '${args.repo}'`,
      () => komodoClient.repos.clone(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'clone',
        resourceType: 'repo',
        resourceId: args.repo,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

export const pullRepoTool: Tool = {
  name: 'komodo_pull_repo',
  description: 'Pull the latest changes for a repo from its remote.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_pull_repo');
    const result = await wrapApiCall(
      `pull repo '${args.repo}'`,
      () => komodoClient.repos.pull(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'pull',
        resourceType: 'repo',
        resourceId: args.repo,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};

export const buildRepoTool: Tool = {
  name: 'komodo_build_repo',
  description: 'Build a repo using its attached builder. Compiles the code in the repository.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_build_repo');
    const result = await wrapApiCall(
      `build repo '${args.repo}'`,
      () => komodoClient.repos.build(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'build',
        resourceType: 'repo',
        resourceId: args.repo,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
