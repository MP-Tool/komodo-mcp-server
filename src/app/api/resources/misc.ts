/**
 * Miscellaneous Resource
 *
 * Provides operations for various Komodo features that don't fit into
 * a specific resource category: config providers, secrets, schedules,
 * container discovery, build stats, export, meta updates, and more.
 *
 * @module app/api/resources/misc
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for miscellaneous Komodo operations.
 */
export class MiscResource extends BaseResource {
  // ── Config Providers ───────────────────────────────────────────────

  /**
   * Lists git providers from the Komodo server configuration.
   *
   * @param target - Optional target filter
   * @param options - Operation options including abort signal
   * @returns List of git providers from config
   */
  async listGitProvidersFromConfig(target?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (target !== undefined) params.target = target;
    return await this.client.read('ListGitProvidersFromConfig' as never, params as never);
  }

  /**
   * Lists docker registries from the Komodo server configuration.
   *
   * @param target - Optional target filter
   * @param options - Operation options including abort signal
   * @returns List of docker registries from config
   */
  async listDockerRegistriesFromConfig(target?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (target !== undefined) params.target = target;
    return await this.client.read('ListDockerRegistriesFromConfig' as never, params as never);
  }

  // ── Secrets & Schedules ────────────────────────────────────────────

  /**
   * Lists available secrets.
   *
   * @param target - Optional target filter
   * @param options - Operation options including abort signal
   * @returns List of secrets
   */
  async listSecrets(target?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (target !== undefined) params.target = target;
    return await this.client.read('ListSecrets' as never, params as never);
  }

  /**
   * Lists schedules with optional tag filtering.
   *
   * @param tags - Optional tags filter
   * @param tagBehavior - Optional tag behavior (e.g., "all", "any")
   * @param options - Operation options including abort signal
   * @returns List of schedules
   */
  async listSchedules(tags?: string[], tagBehavior?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (tags !== undefined) params.tags = tags;
    if (tagBehavior !== undefined) params.tag_behavior = tagBehavior;
    return await this.client.read('ListSchedules' as never, params as never);
  }

  // ── Container Discovery ────────────────────────────────────────────

  /**
   * Lists all Docker containers across all servers.
   *
   * @param servers - Optional list of server IDs/names to query
   * @param options - Operation options including abort signal
   * @returns List of containers across servers
   */
  async listAllDockerContainers(servers?: string[], options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (servers !== undefined) params.servers = servers;
    return await this.client.read('ListAllDockerContainers' as never, params as never);
  }

  /**
   * Gets a summary of Docker containers.
   *
   * @param options - Operation options including abort signal
   * @returns Container summary
   */
  async getDockerContainersSummary(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read('GetDockerContainersSummary' as never, {} as never);
  }

  /**
   * Finds the Komodo resource matching a given container.
   *
   * @param server - Server ID or name
   * @param container - Container name or ID
   * @param options - Operation options including abort signal
   * @returns The matching resource
   */
  async getResourceMatchingContainer(
    server: string,
    container: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read(
      'GetResourceMatchingContainer' as never,
      {
        server,
        container,
      } as never,
    );
  }

  /**
   * Inspects a stack service container.
   *
   * @param stack - Stack ID or name
   * @param service - Service name within the stack
   * @param options - Operation options including abort signal
   * @returns Container inspection result
   */
  async inspectStackContainer(stack: string, service: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read(
      'InspectStackServiceContainer' as never,
      {
        stack,
        service,
      } as never,
    );
  }

  // ── Build Info ─────────────────────────────────────────────────────

  /**
   * Gets monthly build statistics.
   *
   * @param page - Optional page number
   * @param options - Operation options including abort signal
   * @returns Monthly build stats
   */
  async getBuildMonthlyStats(page?: number, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (page !== undefined) params.page = page;
    return await this.client.read('GetBuildMonthlyStats' as never, params as never);
  }

  /**
   * Lists build versions with optional semver filtering.
   *
   * @param build - Build ID or name
   * @param major - Optional major version filter
   * @param minor - Optional minor version filter
   * @param patch - Optional patch version filter
   * @param limit - Optional result limit
   * @param options - Operation options including abort signal
   * @returns List of build versions
   */
  async listBuildVersions(
    build: string,
    major?: number,
    minor?: number,
    patch?: number,
    limit?: number,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { build };
    if (major !== undefined) params.major = major;
    if (minor !== undefined) params.minor = minor;
    if (patch !== undefined) params.patch = patch;
    if (limit !== undefined) params.limit = limit;
    return await this.client.read('ListBuildVersions' as never, params as never);
  }

  // ── Extra Args ─────────────────────────────────────────────────────

  /**
   * Lists common deployment extra arguments.
   *
   * @param query - Optional search query
   * @param options - Operation options including abort signal
   * @returns List of common extra args
   */
  async listCommonDeploymentExtraArgs(query?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (query !== undefined) params.query = query;
    return await this.client.read('ListCommonDeploymentExtraArgs' as never, params as never);
  }

  /**
   * Lists common stack extra arguments.
   *
   * @param query - Optional search query
   * @param options - Operation options including abort signal
   * @returns List of common extra args
   */
  async listCommonStackExtraArgs(query?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (query !== undefined) params.query = query;
    return await this.client.read('ListCommonStackExtraArgs' as never, params as never);
  }

  /**
   * Lists common stack build extra arguments.
   *
   * @param query - Optional search query
   * @param options - Operation options including abort signal
   * @returns List of common extra args
   */
  async listCommonStackBuildExtraArgs(query?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (query !== undefined) params.query = query;
    return await this.client.read('ListCommonStackBuildExtraArgs' as never, params as never);
  }

  /**
   * Lists common build extra arguments.
   *
   * @param query - Optional search query
   * @param options - Operation options including abort signal
   * @returns List of common extra args
   */
  async listCommonBuildExtraArgs(query?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (query !== undefined) params.query = query;
    return await this.client.read('ListCommonBuildExtraArgs' as never, params as never);
  }

  // ── Resource Meta ──────────────────────────────────────────────────

  /**
   * Updates metadata for a resource.
   *
   * @param target - Target object with type and id
   * @param description - Optional new description
   * @param template - Optional template
   * @param tags - Optional tags array
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateResourceMeta(
    target: { type: string; id: string },
    description?: string,
    template?: string,
    tags?: string[],
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { target };
    if (description !== undefined) params.description = description;
    if (template !== undefined) params.template = template;
    if (tags !== undefined) params.tags = tags;
    return await this.client.write('UpdateResourceMeta' as never, params as never);
  }

  /**
   * Updates a tag's color.
   *
   * @param id - Tag ID
   * @param color - New color value
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateTagColor(id: string, color: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('UpdateTagColor' as never, { id, color } as never);
  }

  /**
   * Toggles a variable's secret status.
   *
   * @param name - Variable name
   * @param isSecret - Whether the variable is a secret
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateVariableIsSecret(name: string, isSecret: boolean, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'UpdateVariableIsSecret' as never,
      {
        name,
        is_secret: isSecret,
      } as never,
    );
  }

  /**
   * Creates a deployment from a running container.
   *
   * @param name - Name for the new deployment
   * @param server - Server where the container is running
   * @param options - Operation options including abort signal
   * @returns The created deployment
   */
  async createDeploymentFromContainer(name: string, server: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'CreateDeploymentFromContainer' as never,
      {
        name,
        server,
      } as never,
    );
  }

  // ── Execute Operations ─────────────────────────────────────────────

  /**
   * Cancels an ongoing repo build.
   *
   * @param repo - Repo ID or name
   * @param options - Operation options including abort signal
   * @returns The cancellation result
   */
  async cancelRepoBuild(repo: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('CancelRepoBuild' as never, { repo } as never);
  }

  /**
   * Sends an alert.
   *
   * @param message - Alert message
   * @param level - Optional alert level
   * @param details - Optional alert details
   * @param alerters - Optional list of alerter IDs/names
   * @param options - Operation options including abort signal
   * @returns The send result
   */
  async sendAlert(
    message: string,
    level?: string,
    details?: string,
    alerters?: string[],
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { message };
    if (level !== undefined) params.level = level;
    if (details !== undefined) params.details = details;
    if (alerters !== undefined) params.alerters = alerters;
    return await this.client.execute('SendAlert' as never, params as never);
  }

  /**
   * Clears the repo cache.
   *
   * @param options - Operation options including abort signal
   * @returns The clear result
   */
  async clearRepoCache(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('ClearRepoCache' as never, {} as never);
  }

  /**
   * Backs up the core database.
   *
   * @param options - Operation options including abort signal
   * @returns The backup result
   */
  async backupCoreDatabase(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BackupCoreDatabase' as never, {} as never);
  }

  /**
   * Batch deploys stacks if they have changed.
   *
   * @param pattern - Name pattern to match
   * @param options - Operation options including abort signal
   * @returns The batch deploy result
   */
  async batchDeployStackIfChanged(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchDeployStackIfChanged' as never, { pattern } as never);
  }

  // ── Export ─────────────────────────────────────────────────────────

  /**
   * Exports all resources to TOML.
   *
   * @param includeResources - Optional flag to include resources
   * @param tags - Optional tags filter
   * @param includeVariables - Optional flag to include variables
   * @param includeUserGroups - Optional flag to include user groups
   * @param options - Operation options including abort signal
   * @returns The TOML export
   */
  async exportAllResourcesToToml(
    includeResources?: boolean,
    tags?: string[],
    includeVariables?: boolean,
    includeUserGroups?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (includeResources !== undefined) params.include_resources = includeResources;
    if (tags !== undefined) params.tags = tags;
    if (includeVariables !== undefined) params.include_variables = includeVariables;
    if (includeUserGroups !== undefined) params.include_user_groups = includeUserGroups;
    return await this.client.read('ExportAllResourcesToToml' as never, params as never);
  }

  /**
   * Exports specific resources to TOML.
   *
   * @param targets - Optional list of resource targets
   * @param userGroups - Optional list of user groups
   * @param includeVariables - Optional flag to include variables
   * @param options - Operation options including abort signal
   * @returns The TOML export
   */
  async exportResourcesToToml(
    targets?: Array<{ type: string; id: string }>,
    userGroups?: string[],
    includeVariables?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (targets !== undefined) params.targets = targets;
    if (userGroups !== undefined) params.user_groups = userGroups;
    if (includeVariables !== undefined) params.include_variables = includeVariables;
    return await this.client.read('ExportResourcesToToml' as never, params as never);
  }
}
