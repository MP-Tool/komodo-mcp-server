/**
 * System Resource
 *
 * Provides system-level operations for Komodo servers and core.
 *
 * @module app/api/resources/system
 */

import { BaseResource } from '../base.js';
import { validateServerId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

export class SystemResource extends BaseResource {
  async getSystemInfo(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetSystemInformation' as never, { server: serverId } as never);
    return response;
  }

  async getSystemStats(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetSystemStats' as never, { server: serverId } as never);
    return response;
  }

  async listProcesses(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListSystemProcesses' as never, { server: serverId } as never);
    return response;
  }

  async getHistoricalStats(
    serverId: string,
    granularity: string,
    page?: number,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { server: serverId, granularity };
    if (page !== undefined) params.page = page;
    const response = await this.client.read('GetHistoricalServerStats' as never, params as never);
    return response;
  }

  async getPeripheryVersion(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetPeripheryVersion' as never, { server: serverId } as never);
    return response;
  }

  async getCoreInfo(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetCoreInfo' as never, {} as never);
    return response;
  }

  async listComposeProjects(serverId: string, options?: ApiOperationOptions): Promise<unknown[]> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListComposeProjects' as never, { server: serverId } as never);
    return (response as unknown[]) || [];
  }

  async getServersSummary(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetServersSummary' as never, {} as never);
    return response;
  }
}
