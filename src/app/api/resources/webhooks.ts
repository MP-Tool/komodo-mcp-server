/**
 * Webhook Resource
 *
 * Provides operations for managing webhooks on Komodo resources.
 * Supports creating and deleting webhooks for builds, stacks, repos, syncs, and actions,
 * as well as checking webhook enabled status.
 *
 * @module app/api/resources/webhooks
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing webhooks on Komodo resources.
 */
export class WebhookResource extends BaseResource {
  // =========================================================================
  // Build Webhooks
  // =========================================================================

  async createBuildWebhook(buildId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('CreateBuildWebhook' as never, { build: buildId } as never);
  }

  async deleteBuildWebhook(buildId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteBuildWebhook' as never, { build: buildId } as never);
  }

  async getBuildWebhookEnabled(buildId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read('GetBuildWebhookEnabled' as never, { build: buildId } as never);
  }

  // =========================================================================
  // Stack Webhooks
  // =========================================================================

  async createStackWebhook(stackId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('CreateStackWebhook' as never, { stack: stackId } as never);
  }

  async deleteStackWebhook(stackId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteStackWebhook' as never, { stack: stackId } as never);
  }

  // =========================================================================
  // Repo Webhooks
  // =========================================================================

  async createRepoWebhook(repoId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('CreateRepoWebhook' as never, { repo: repoId } as never);
  }

  async deleteRepoWebhook(repoId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteRepoWebhook' as never, { repo: repoId } as never);
  }

  async getRepoWebhooksEnabled(repoId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read('GetRepoWebhooksEnabled' as never, { repo: repoId } as never);
  }

  // =========================================================================
  // Sync Webhooks
  // =========================================================================

  async createSyncWebhook(syncId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('CreateSyncWebhook' as never, { sync: syncId } as never);
  }

  async deleteSyncWebhook(syncId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteSyncWebhook' as never, { sync: syncId } as never);
  }

  async getSyncWebhooksEnabled(syncId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.read('GetSyncWebhooksEnabled' as never, { sync: syncId } as never);
  }

  // =========================================================================
  // Action Webhooks
  // =========================================================================

  async createActionWebhook(actionId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('CreateActionWebhook' as never, { action: actionId } as never);
  }

  async deleteActionWebhook(actionId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('DeleteActionWebhook' as never, { action: actionId } as never);
  }
}
