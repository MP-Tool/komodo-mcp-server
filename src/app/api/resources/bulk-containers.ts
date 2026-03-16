/**
 * Bulk Container Operations Resource
 *
 * Provides bulk lifecycle operations for all containers on a server,
 * and individual container destroy operation.
 *
 * @module app/api/resources/bulk-containers
 */

import { BaseResource } from '../base.js';
import { validateServerId, validateContainerName } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

export class BulkContainerResource extends BaseResource {
  async startAll(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('StartAllContainers' as never, { server: serverId } as never);
  }

  async restartAll(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('RestartAllContainers' as never, { server: serverId } as never);
  }

  async pauseAll(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('PauseAllContainers' as never, { server: serverId } as never);
  }

  async unpauseAll(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('UnpauseAllContainers' as never, { server: serverId } as never);
  }

  async stopAll(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('StopAllContainers' as never, { server: serverId } as never);
  }

  async destroy(
    serverId: string,
    containerName: string,
    signal?: string,
    time?: number,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateServerId(serverId);
    validateContainerName(containerName);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { server: serverId, container: containerName };
    if (signal) params.signal = signal;
    if (time !== undefined) params.time = time;
    return await this.client.execute('DestroyContainer' as never, params as never);
  }

  async pruneBuilders(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('PruneDockerBuilders' as never, { server: serverId } as never);
  }

  async pruneBuildx(serverId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateServerId(serverId);
    this.checkAborted(options?.signal);
    return await this.client.execute('PruneBuildx' as never, { server: serverId } as never);
  }
}
