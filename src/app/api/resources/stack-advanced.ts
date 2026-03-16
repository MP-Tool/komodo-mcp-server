/**
 * Stack Advanced Resource
 *
 * Additional stack operations beyond basic CRUD and lifecycle.
 *
 * @module app/api/resources/stack-advanced
 */

import { BaseResource } from '../base.js';
import { validateStackId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

export class StackAdvancedResource extends BaseResource {
  async listServices(stackId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);
    return await this.client.read('ListStackServices' as never, { stack: stackId } as never);
  }

  async getLog(
    stackId: string,
    services: string[],
    tail?: number,
    timestamps?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { stack: stackId, services };
    if (tail !== undefined) params.tail = tail;
    if (timestamps !== undefined) params.timestamps = timestamps;
    return await this.client.read('GetStackLog' as never, params as never);
  }

  async searchLog(
    stackId: string,
    services: string[],
    terms: string[],
    combinator?: string,
    invert?: boolean,
    timestamps?: boolean,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { stack: stackId, services, terms };
    if (combinator) params.combinator = combinator;
    if (invert !== undefined) params.invert = invert;
    if (timestamps !== undefined) params.timestamps = timestamps;
    return await this.client.read('SearchStackLog' as never, params as never);
  }

  async getWebhooksEnabled(stackId: string, options?: ApiOperationOptions): Promise<unknown> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);
    return await this.client.read('GetStackWebhooksEnabled' as never, { stack: stackId } as never);
  }

  async deployIfChanged(stackId: string, stopTime?: number, options?: ApiOperationOptions): Promise<unknown> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { stack: stackId };
    if (stopTime !== undefined) params.stop_time = stopTime;
    return await this.client.execute('DeployStackIfChanged' as never, params as never);
  }

  async runService(
    stackId: string,
    service: string,
    command?: string,
    detach?: boolean,
    env?: string,
    workdir?: string,
    user?: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { stack: stackId, service };
    if (command) params.command = command;
    if (detach !== undefined) params.detach = detach;
    if (env) params.env = env;
    if (workdir) params.workdir = workdir;
    if (user) params.user = user;
    return await this.client.execute('RunStackService' as never, params as never);
  }
}
