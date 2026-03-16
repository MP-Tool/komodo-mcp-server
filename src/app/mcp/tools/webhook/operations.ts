/**
 * Webhook Operations Tools
 *
 * MCP tools for creating, deleting, and checking webhooks on Komodo resources
 * (builds, stacks, repos, syncs, actions).
 *
 * @module tools/webhook/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

// ============================================================================
// Build Webhook Tools
// ============================================================================

export const createBuildWebhookTool: Tool = {
  name: 'komodo_create_build_webhook',
  description:
    'Create a webhook for a build. Returns the webhook URL that can be used to trigger the build externally.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_build_webhook');
    const result = await wrapApiCall(
      'createBuildWebhook',
      () => validClient.webhooks.createBuildWebhook(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook created for build "${args.build}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteBuildWebhookTool: Tool = {
  name: 'komodo_delete_build_webhook',
  description: 'Delete the webhook for a build, removing external trigger access.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_build_webhook');
    const result = await wrapApiCall(
      'deleteBuildWebhook',
      () => validClient.webhooks.deleteBuildWebhook(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook deleted for build "${args.build}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getBuildWebhookEnabledTool: Tool = {
  name: 'komodo_get_build_webhook_enabled',
  description: 'Check if a webhook is enabled for a build.',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_build_webhook_enabled');
    const result = await wrapApiCall(
      'getBuildWebhookEnabled',
      () => validClient.webhooks.getBuildWebhookEnabled(args.build, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook status for build "${args.build}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ============================================================================
// Stack Webhook Tools
// ============================================================================

export const createStackWebhookTool: Tool = {
  name: 'komodo_create_stack_webhook',
  description:
    'Create a webhook for a stack. Returns the webhook URL that can be used to trigger the stack externally.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_stack_webhook');
    const result = await wrapApiCall(
      'createStackWebhook',
      () => validClient.webhooks.createStackWebhook(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook created for stack "${args.stack}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteStackWebhookTool: Tool = {
  name: 'komodo_delete_stack_webhook',
  description: 'Delete the webhook for a stack, removing external trigger access.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_stack_webhook');
    const result = await wrapApiCall(
      'deleteStackWebhook',
      () => validClient.webhooks.deleteStackWebhook(args.stack, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook deleted for stack "${args.stack}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ============================================================================
// Repo Webhook Tools
// ============================================================================

export const createRepoWebhookTool: Tool = {
  name: 'komodo_create_repo_webhook',
  description: 'Create a webhook for a repo. Returns the webhook URL that can be used to trigger the repo externally.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_repo_webhook');
    const result = await wrapApiCall(
      'createRepoWebhook',
      () => validClient.webhooks.createRepoWebhook(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook created for repo "${args.repo}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteRepoWebhookTool: Tool = {
  name: 'komodo_delete_repo_webhook',
  description: 'Delete the webhook for a repo, removing external trigger access.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_repo_webhook');
    const result = await wrapApiCall(
      'deleteRepoWebhook',
      () => validClient.webhooks.deleteRepoWebhook(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook deleted for repo "${args.repo}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getRepoWebhooksEnabledTool: Tool = {
  name: 'komodo_get_repo_webhooks_enabled',
  description: 'Check if webhooks are enabled for a repo.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_repo_webhooks_enabled');
    const result = await wrapApiCall(
      'getRepoWebhooksEnabled',
      () => validClient.webhooks.getRepoWebhooksEnabled(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhooks status for repo "${args.repo}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ============================================================================
// Sync Webhook Tools
// ============================================================================

export const createSyncWebhookTool: Tool = {
  name: 'komodo_create_sync_webhook',
  description:
    'Create a webhook for a resource sync. Returns the webhook URL that can be used to trigger the sync externally.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_sync_webhook');
    const result = await wrapApiCall(
      'createSyncWebhook',
      () => validClient.webhooks.createSyncWebhook(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook created for sync "${args.sync}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteSyncWebhookTool: Tool = {
  name: 'komodo_delete_sync_webhook',
  description: 'Delete the webhook for a resource sync, removing external trigger access.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_sync_webhook');
    const result = await wrapApiCall(
      'deleteSyncWebhook',
      () => validClient.webhooks.deleteSyncWebhook(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook deleted for sync "${args.sync}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getSyncWebhooksEnabledTool: Tool = {
  name: 'komodo_get_sync_webhooks_enabled',
  description: 'Check if webhooks are enabled for a resource sync.',
  schema: z.object({
    sync: z.string().describe(PARAM_DESCRIPTIONS.SYNC_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_sync_webhooks_enabled');
    const result = await wrapApiCall(
      'getSyncWebhooksEnabled',
      () => validClient.webhooks.getSyncWebhooksEnabled(args.sync, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhooks status for sync "${args.sync}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ============================================================================
// Action Webhook Tools
// ============================================================================

export const createActionWebhookTool: Tool = {
  name: 'komodo_create_action_webhook',
  description:
    'Create a webhook for an action. Returns the webhook URL that can be used to trigger the action externally.',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_action_webhook');
    const result = await wrapApiCall(
      'createActionWebhook',
      () => validClient.webhooks.createActionWebhook(args.action, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook created for action "${args.action}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteActionWebhookTool: Tool = {
  name: 'komodo_delete_action_webhook',
  description: 'Delete the webhook for an action, removing external trigger access.',
  schema: z.object({
    action: z.string().describe(PARAM_DESCRIPTIONS.ACTION_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_delete_action_webhook');
    const result = await wrapApiCall(
      'deleteActionWebhook',
      () => validClient.webhooks.deleteActionWebhook(args.action, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Webhook deleted for action "${args.action}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};
