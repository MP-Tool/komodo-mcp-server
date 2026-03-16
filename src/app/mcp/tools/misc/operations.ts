/**
 * Miscellaneous Tools
 *
 * MCP tools for various Komodo operations: config providers, secrets,
 * schedules, container discovery, build stats, extra args, resource meta,
 * export, alerts, cache management, and more.
 *
 * @module tools/misc/operations
 */

import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

// ── Config Provider Tools ────────────────────────────────────────────

export const listGitProvidersFromConfigTool: Tool = {
  name: 'komodo_list_git_providers_from_config',
  description: 'List Git providers configured in the Komodo server configuration.',
  schema: z.object({
    target: z.string().optional().describe('Optional target filter'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_git_providers_from_config');
    const result = await wrapApiCall(
      'listGitProvidersFromConfig',
      () => validClient.misc.listGitProvidersFromConfig(args.target, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Git providers from config:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listDockerRegistriesFromConfigTool: Tool = {
  name: 'komodo_list_docker_registries_from_config',
  description: 'List Docker registries configured in the Komodo server configuration.',
  schema: z.object({
    target: z.string().optional().describe('Optional target filter'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_docker_registries_from_config');
    const result = await wrapApiCall(
      'listDockerRegistriesFromConfig',
      () => validClient.misc.listDockerRegistriesFromConfig(args.target, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Docker registries from config:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ── Secrets & Schedules Tools ────────────────────────────────────────

export const listSecretsTool: Tool = {
  name: 'komodo_list_secrets',
  description: 'List available secrets in Komodo. Secrets are used in resource configurations as variable references.',
  schema: z.object({
    target: z.string().optional().describe('Optional target filter'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_secrets');
    const result = await wrapApiCall(
      'listSecrets',
      () => validClient.misc.listSecrets(args.target, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Secrets:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listSchedulesTool: Tool = {
  name: 'komodo_list_schedules',
  description: 'List configured schedules in Komodo. Schedules trigger automated operations on resources.',
  schema: z.object({
    tags: z.array(z.string()).optional().describe('Filter by tags'),
    tag_behavior: z
      .string()
      .optional()
      .describe('Tag matching behavior (e.g., "all" to match all tags, "any" to match any tag)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_schedules');
    const result = await wrapApiCall(
      'listSchedules',
      () => validClient.misc.listSchedules(args.tags, args.tag_behavior, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Schedules:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ── Container Discovery Tools ────────────────────────────────────────

export const listAllDockerContainersTool: Tool = {
  name: 'komodo_list_all_docker_containers',
  description:
    'List all Docker containers across all registered servers. Useful for a global view of running workloads.',
  schema: z.object({
    servers: z
      .array(z.string())
      .optional()
      .describe('Optional list of server IDs/names to query. If omitted, queries all servers.'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_all_docker_containers');
    const result = await wrapApiCall(
      'listAllDockerContainers',
      () => validClient.misc.listAllDockerContainers(args.servers, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`All Docker containers:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getDockerContainersSummaryTool: Tool = {
  name: 'komodo_get_docker_containers_summary',
  description: 'Get a summary of Docker containers across all servers including counts by state.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_docker_containers_summary');
    const result = await wrapApiCall(
      'getDockerContainersSummary',
      () => validClient.misc.getDockerContainersSummary({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Docker containers summary:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const getResourceMatchingContainerTool: Tool = {
  name: 'komodo_get_resource_matching_container',
  description: 'Find the Komodo resource (deployment, stack service, etc.) that matches a given container on a server.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_resource_matching_container');
    const result = await wrapApiCall(
      'getResourceMatchingContainer',
      () => validClient.misc.getResourceMatchingContainer(args.server, args.container, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Resource matching container "${args.container}" on server "${args.server}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const inspectStackContainerTool: Tool = {
  name: 'komodo_inspect_stack_container',
  description: 'Inspect a specific service container within a Komodo-managed stack.',
  schema: z.object({
    stack: z.string().describe(PARAM_DESCRIPTIONS.STACK_ID),
    service: z.string().describe('Service name within the stack to inspect'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_inspect_stack_container');
    const result = await wrapApiCall(
      'inspectStackContainer',
      () => validClient.misc.inspectStackContainer(args.stack, args.service, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Stack "${args.stack}" service "${args.service}" container inspection:\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

// ── Build Info Tools ─────────────────────────────────────────────────

export const getBuildMonthlyStatsTool: Tool = {
  name: 'komodo_get_build_monthly_stats',
  description: 'Get monthly build statistics showing build counts, success rates, and timing.',
  schema: z.object({
    page: z.number().optional().describe('Page number for pagination (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_get_build_monthly_stats');
    const result = await wrapApiCall(
      'getBuildMonthlyStats',
      () => validClient.misc.getBuildMonthlyStats(args.page, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Build monthly stats:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listBuildVersionsTool: Tool = {
  name: 'komodo_list_build_versions',
  description:
    'List available versions for a build. Optionally filter by semantic version components (major, minor, patch).',
  schema: z.object({
    build: z.string().describe(PARAM_DESCRIPTIONS.BUILD_ID),
    major: z.number().optional().describe('Filter by major version'),
    minor: z.number().optional().describe('Filter by minor version'),
    patch: z.number().optional().describe('Filter by patch version'),
    limit: z.number().optional().describe('Maximum number of results to return'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_build_versions');
    const result = await wrapApiCall(
      'listBuildVersions',
      () =>
        validClient.misc.listBuildVersions(args.build, args.major, args.minor, args.patch, args.limit, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(`Build versions for "${args.build}":\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ── Extra Args Tools ─────────────────────────────────────────────────

export const listCommonDeploymentExtraArgsTool: Tool = {
  name: 'komodo_list_common_deployment_extra_args',
  description: 'List common extra arguments used in deployment configurations. Useful for discovery and autocomplete.',
  schema: z.object({
    query: z.string().optional().describe('Search query to filter args'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_common_deployment_extra_args');
    const result = await wrapApiCall(
      'listCommonDeploymentExtraArgs',
      () => validClient.misc.listCommonDeploymentExtraArgs(args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Common deployment extra args:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listCommonStackExtraArgsTool: Tool = {
  name: 'komodo_list_common_stack_extra_args',
  description: 'List common extra arguments used in stack configurations. Useful for discovery and autocomplete.',
  schema: z.object({
    query: z.string().optional().describe('Search query to filter args'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_common_stack_extra_args');
    const result = await wrapApiCall(
      'listCommonStackExtraArgs',
      () => validClient.misc.listCommonStackExtraArgs(args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Common stack extra args:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listCommonStackBuildExtraArgsTool: Tool = {
  name: 'komodo_list_common_stack_build_extra_args',
  description: 'List common extra arguments used in stack build configurations.',
  schema: z.object({
    query: z.string().optional().describe('Search query to filter args'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_common_stack_build_extra_args');
    const result = await wrapApiCall(
      'listCommonStackBuildExtraArgs',
      () => validClient.misc.listCommonStackBuildExtraArgs(args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Common stack build extra args:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const listCommonBuildExtraArgsTool: Tool = {
  name: 'komodo_list_common_build_extra_args',
  description: 'List common extra arguments used in image build configurations.',
  schema: z.object({
    query: z.string().optional().describe('Search query to filter args'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_list_common_build_extra_args');
    const result = await wrapApiCall(
      'listCommonBuildExtraArgs',
      () => validClient.misc.listCommonBuildExtraArgs(args.query, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Common build extra args:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

// ── Resource Meta Tools ──────────────────────────────────────────────

export const updateResourceMetaTool: Tool = {
  name: 'komodo_update_resource_meta',
  description:
    'Update metadata (description, template, tags) for any Komodo resource. Target specifies the resource type and ID.',
  schema: z.object({
    target: z
      .object({
        type: z
          .string()
          .describe(
            'Resource type (e.g., "Server", "Stack", "Deployment", "Build", "Repo", "Procedure", "Action", "Alerter", "Builder", "ResourceSync")',
          ),
        id: z.string().describe('Resource ID or name'),
      })
      .describe('Target resource to update'),
    description: z.string().optional().describe('New description for the resource'),
    template: z.string().optional().describe('New template for the resource'),
    tags: z.array(z.string()).optional().describe('New tags for the resource (replaces existing tags)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_update_resource_meta');
    const result = await wrapApiCall(
      'updateResourceMeta',
      () =>
        validClient.misc.updateResourceMeta(args.target, args.description, args.template, args.tags, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(
      `Resource meta updated for ${args.target.type} "${args.target.id}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const updateTagColorTool: Tool = {
  name: 'komodo_update_tag_color',
  description: 'Update the display color of a tag.',
  schema: z.object({
    id: z.string().describe(PARAM_DESCRIPTIONS.TAG_ID),
    color: z.string().describe('New color value (e.g., "#FF5733", "red")'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_update_tag_color');
    const result = await wrapApiCall(
      'updateTagColor',
      () => validClient.misc.updateTagColor(args.id, args.color, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Tag "${args.id}" color updated to "${args.color}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateVariableIsSecretTool: Tool = {
  name: 'komodo_update_variable_is_secret',
  description: 'Toggle whether a variable is treated as a secret. Secret variables have their values hidden in the UI.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.VARIABLE_NAME),
    is_secret: z.boolean().describe('Whether the variable should be treated as a secret'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_update_variable_is_secret');
    const result = await wrapApiCall(
      'updateVariableIsSecret',
      () => validClient.misc.updateVariableIsSecret(args.name, args.is_secret, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Variable "${args.name}" secret status set to ${args.is_secret}.\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

export const createDeploymentFromContainerTool: Tool = {
  name: 'komodo_create_deployment_from_container',
  description:
    'Create a new Komodo deployment resource from an existing running container. Imports the container configuration.',
  schema: z.object({
    name: z.string().describe('Name for the new deployment'),
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_create_deployment_from_container');
    const result = await wrapApiCall(
      'createDeploymentFromContainer',
      () => validClient.misc.createDeploymentFromContainer(args.name, args.server, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Deployment "${args.name}" created from container on server "${args.server}".\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

// ── Execute Tools ────────────────────────────────────────────────────

export const cancelRepoBuildTool: Tool = {
  name: 'komodo_cancel_repo_build',
  description: 'Cancel an ongoing repo build operation.',
  schema: z.object({
    repo: z.string().describe(PARAM_DESCRIPTIONS.REPO_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_cancel_repo_build');
    const result = await wrapApiCall(
      'cancelRepoBuild',
      () => validClient.misc.cancelRepoBuild(args.repo, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repo build cancelled for "${args.repo}".\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const sendAlertTool: Tool = {
  name: 'komodo_send_alert',
  description: 'Send an alert through configured alerters. Useful for notifying about events or issues.',
  schema: z.object({
    message: z.string().describe('Alert message'),
    level: z.string().optional().describe('Alert level (e.g., "Ok", "Warning", "Critical")'),
    details: z.string().optional().describe('Additional alert details'),
    alerters: z.array(z.string()).optional().describe('Specific alerter IDs/names to send through (omit for all)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_send_alert');
    const result = await wrapApiCall(
      'sendAlert',
      () =>
        validClient.misc.sendAlert(args.message, args.level, args.details, args.alerters, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(`Alert sent successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const clearRepoCacheTool: Tool = {
  name: 'komodo_clear_repo_cache',
  description: 'Clear the global repo cache. Forces Komodo to re-fetch repo data on next access.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_clear_repo_cache');
    const result = await wrapApiCall(
      'clearRepoCache',
      () => validClient.misc.clearRepoCache({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Repo cache cleared.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const backupCoreDatabaseTool: Tool = {
  name: 'komodo_backup_core_database',
  description: 'Trigger a backup of the Komodo core database.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_backup_core_database');
    const result = await wrapApiCall(
      'backupCoreDatabase',
      () => validClient.misc.backupCoreDatabase({ signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Core database backup triggered.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const batchDeployStackIfChangedTool: Tool = {
  name: 'komodo_batch_deploy_stack_if_changed',
  description:
    'Batch deploy all stacks matching a name pattern, but only if their configuration has changed since last deploy.',
  schema: z.object({
    pattern: z
      .string()
      .describe('Resource name pattern to match (supports glob-style matching). Example: "prod-*", "staging-*"'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_batch_deploy_stack_if_changed');
    const result = await wrapApiCall(
      'batchDeployStackIfChanged',
      () => validClient.misc.batchDeployStackIfChanged(args.pattern, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      `Batch deploy-if-changed triggered for pattern "${args.pattern}":\n\n${JSON.stringify(result, null, 2)}`,
    );
  },
};

// ── Export Tools ──────────────────────────────────────────────────────

export const exportAllResourcesToTomlTool: Tool = {
  name: 'komodo_export_all_resources_to_toml',
  description:
    'Export all Komodo resources to TOML format. Useful for backup, migration, or infrastructure-as-code workflows.',
  schema: z.object({
    include_resources: z.boolean().optional().describe('Whether to include resources in the export (default: true)'),
    tags: z.array(z.string()).optional().describe('Filter export to resources with these tags'),
    include_variables: z.boolean().optional().describe('Whether to include variables in the export'),
    include_user_groups: z.boolean().optional().describe('Whether to include user groups in the export'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_export_all_resources_to_toml');
    const result = await wrapApiCall(
      'exportAllResourcesToToml',
      () =>
        validClient.misc.exportAllResourcesToToml(
          args.include_resources,
          args.tags,
          args.include_variables,
          args.include_user_groups,
          { signal: abortSignal },
        ),
      abortSignal,
    );
    return successResponse(`TOML Export:\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const exportResourcesToTomlTool: Tool = {
  name: 'komodo_export_resources_to_toml',
  description: 'Export specific Komodo resources to TOML format by specifying target resources.',
  schema: z.object({
    targets: z
      .array(
        z.object({
          type: z.string().describe('Resource type'),
          id: z.string().describe('Resource ID or name'),
        }),
      )
      .optional()
      .describe('List of specific resources to export'),
    user_groups: z.array(z.string()).optional().describe('User groups to include in the export'),
    include_variables: z.boolean().optional().describe('Whether to include variables in the export'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const validClient = requireClient(client, 'komodo_export_resources_to_toml');
    const result = await wrapApiCall(
      'exportResourcesToToml',
      () =>
        validClient.misc.exportResourcesToToml(args.targets, args.user_groups, args.include_variables, {
          signal: abortSignal,
        }),
      abortSignal,
    );
    return successResponse(`TOML Export:\n\n${JSON.stringify(result, null, 2)}`);
  },
};
