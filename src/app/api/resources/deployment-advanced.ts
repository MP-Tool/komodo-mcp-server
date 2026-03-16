/**
 * Deployment Advanced Resource
 *
 * Additional deployment operations beyond basic CRUD and lifecycle.
 *
 * @module app/api/resources/deployment-advanced
 */

import { BaseResource } from '../base.js';
import { validateDeploymentId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

export class DeploymentAdvancedResource extends BaseResource {
  async getLog(
    deploymentId: string,
    tail?: number,
    timestamps?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { deployment: deploymentId };
    if (tail !== undefined) params.tail = tail;
    if (timestamps !== undefined) params.timestamps = timestamps;
    return await this.client.read('GetDeploymentLog' as never, params as never);
  }

  async searchLog(
    deploymentId: string,
    terms: string[],
    combinator?: string,
    invert?: boolean,
    timestamps?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { deployment: deploymentId, terms };
    if (combinator) params.combinator = combinator;
    if (invert !== undefined) params.invert = invert;
    if (timestamps !== undefined) params.timestamps = timestamps;
    return await this.client.read('SearchDeploymentLog' as never, params as never);
  }

  async getStats(deploymentId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    return await this.client.read('GetDeploymentStats' as never, { deployment: deploymentId } as never);
  }

  async getContainer(deploymentId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    return await this.client.read('GetDeploymentContainer' as never, { deployment: deploymentId } as never);
  }

  async inspectContainer(deploymentId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    return await this.client.read('InspectDeploymentContainer' as never, { deployment: deploymentId } as never);
  }
}
