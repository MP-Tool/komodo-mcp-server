/**
 * Update Resource
 *
 * Provides read-only operations for Updates and Alerts in Komodo.
 * Updates track the status of executed operations. Alerts track system notifications.
 *
 * @module app/api/resources/updates
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for reading Updates and Alerts.
 */
export class UpdateResource extends BaseResource {
  async list(query?: Record<string, unknown>, options?: ApiOperationOptions): Promise<unknown[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListUpdates', query || {});
    return response || [];
  }

  async get(updateId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetUpdate', { id: updateId });
    return response;
  }

  async listAlerts(query?: Record<string, unknown>, options?: ApiOperationOptions): Promise<unknown[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListAlerts', query || {});
    return response || [];
  }

  async getAlert(alertId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetAlert', { id: alertId });
    return response;
  }
}
