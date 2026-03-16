/**
 * Resource Info Resource
 *
 * Provides action state, summary, and full list operations for Komodo resources.
 * These are read-only operations that retrieve status and overview information
 * across all resource types.
 *
 * @module app/api/resources/resource-info
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource types that support action state queries.
 */
type ActionStateResource =
  | 'Server'
  | 'Deployment'
  | 'Stack'
  | 'Build'
  | 'Repo'
  | 'Procedure'
  | 'Action'
  | 'ResourceSync';

/**
 * Resource types that support summary queries.
 */
type SummaryResource =
  | 'Deployments'
  | 'Stacks'
  | 'Builds'
  | 'Builders'
  | 'Repos'
  | 'ResourceSyncs'
  | 'Actions'
  | 'Procedures'
  | 'Alerters';

/**
 * Resource types that support full list queries.
 */
type FullListResource =
  | 'Servers'
  | 'Deployments'
  | 'Stacks'
  | 'Builds'
  | 'Builders'
  | 'Repos'
  | 'ResourceSyncs'
  | 'Actions'
  | 'Procedures'
  | 'Alerters';

/**
 * Maps resource types to their API parameter key names for action state queries.
 */
const ACTION_STATE_PARAM_KEY: Record<ActionStateResource, string> = {
  Server: 'server',
  Deployment: 'deployment',
  Stack: 'stack',
  Build: 'build',
  Repo: 'repo',
  Procedure: 'procedure',
  Action: 'action',
  ResourceSync: 'sync',
};

/**
 * Resource for querying action state, summaries, and full lists across all Komodo resource types.
 */
export class ResourceInfoResource extends BaseResource {
  /**
   * Gets the current action state for a resource.
   *
   * Action state indicates what operation (if any) is currently running
   * on the resource (e.g., deploying, building, syncing).
   *
   * @param resourceType - The type of resource to query
   * @param id - The resource ID or name
   * @param options - Operation options including abort signal
   * @returns The action state for the resource
   * @throws Error on API failure or cancellation
   */
  async getActionState(resourceType: ActionStateResource, id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const paramKey = ACTION_STATE_PARAM_KEY[resourceType];
    return await this.client.read(`Get${resourceType}ActionState` as never, { [paramKey]: id } as never);
  }

  /**
   * Gets a summary overview for a resource type.
   *
   * Summaries provide aggregate counts and status breakdowns
   * without returning full resource details.
   *
   * @param resourceType - The resource type to summarize (plural form)
   * @param options - Operation options including abort signal
   * @returns The summary for the resource type
   * @throws Error on API failure or cancellation
   */
  async getSummary(resourceType: SummaryResource, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read(`Get${resourceType}Summary` as never, {} as never);
  }

  /**
   * Lists all resources of a type with full details.
   *
   * Unlike the standard list operations that return summary items,
   * this returns complete resource objects including configuration.
   *
   * @param resourceType - The resource type to list (plural form)
   * @param query - Optional search query to filter results
   * @param options - Operation options including abort signal
   * @returns The full list of resources
   * @throws Error on API failure or cancellation
   */
  async listFull(resourceType: FullListResource, query?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = {};
    if (query) params.query = query;
    return await this.client.read(`ListFull${resourceType}` as never, params as never);
  }
}
