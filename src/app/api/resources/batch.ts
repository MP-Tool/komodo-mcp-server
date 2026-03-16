/**
 * Batch Operations Resource
 *
 * Provides batch operations for executing actions across multiple resources matching a pattern.
 *
 * @module app/api/resources/batch
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

export class BatchResource extends BaseResource {
  async batchDeploy(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchDeploy' as never, { pattern } as never);
  }

  async batchDestroyDeployment(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchDestroyDeployment' as never, { pattern } as never);
  }

  async batchDeployStack(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchDeployStack' as never, { pattern } as never);
  }

  async batchDestroyStack(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchDestroyStack' as never, { pattern } as never);
  }

  async batchPullStack(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchPullStack' as never, { pattern } as never);
  }

  async batchRunBuild(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchRunBuild' as never, { pattern } as never);
  }

  async batchCloneRepo(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchCloneRepo' as never, { pattern } as never);
  }

  async batchPullRepo(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchPullRepo' as never, { pattern } as never);
  }

  async batchBuildRepo(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchBuildRepo' as never, { pattern } as never);
  }

  async batchRunAction(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchRunAction' as never, { pattern } as never);
  }

  async batchRunProcedure(pattern: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.execute('BatchRunProcedure' as never, { pattern } as never);
  }
}
