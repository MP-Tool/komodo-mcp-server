/**
 * Permission Resource
 *
 * Provides operations for managing Permissions and API Keys in Komodo.
 * Includes permission queries, target-level permission updates,
 * base permission toggles, and API key lifecycle management.
 *
 * @module app/api/resources/permissions
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Permissions and API Keys.
 */
export class PermissionResource extends BaseResource {
  // ============================================================================
  // Permission Operations
  // ============================================================================

  /**
   * Lists all permissions.
   *
   * @param options - Operation options including abort signal
   * @returns A list of all permissions
   */
  async list(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListPermissions' as never, {} as never);
    return response;
  }

  /**
   * Gets permissions for a specific target resource.
   *
   * @param target - The target object with type and id
   * @param options - Operation options including abort signal
   * @returns The permissions for the target
   */
  async getPermission(target: { type: string; id: string }, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetPermission' as never, { target } as never);
    return response;
  }

  /**
   * Lists permissions that a specific user or user group has on targets.
   *
   * @param userTarget - The user target object containing type and id
   * @param options - Operation options including abort signal
   * @returns The permissions for the user target
   */
  async listUserTargetPermissions(
    userTarget: { user_target: { type: string; id: string } },
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListUserTargetPermissions' as never, userTarget as never);
    return response;
  }

  /**
   * Updates a permission on a specific target for a user or group.
   *
   * @param userTarget - The user target (type and id)
   * @param permission - The permission to set
   * @param level - The permission level
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updatePermissionOnTarget(
    userTarget: { type: string; id: string },
    permission: string,
    level: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write(
      'UpdatePermissionOnTarget' as never,
      { user_target: userTarget, permission, level } as never,
    );
    return response;
  }

  /**
   * Toggles base permissions for a user.
   *
   * @param userId - The user ID
   * @param enabled - Whether base permissions should be enabled
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateUserBasePermissions(userId: string, enabled: boolean, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write(
      'UpdateUserBasePermissions' as never,
      { user_id: userId, enabled } as never,
    );
    return response;
  }

  // ============================================================================
  // API Key Operations
  // ============================================================================

  /**
   * Lists all API keys.
   *
   * @param options - Operation options including abort signal
   * @returns A list of API keys
   */
  async listApiKeys(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListApiKeys' as never, {} as never);
    return response;
  }

  /**
   * Lists API keys for a specific service user.
   *
   * @param user - The service user name or ID
   * @param options - Operation options including abort signal
   * @returns A list of API keys for the user
   */
  async listApiKeysForServiceUser(user: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListApiKeysForServiceUser' as never, { user } as never);
    return response;
  }

  /**
   * Creates a new API key for a service user.
   *
   * @param user - The service user name or ID
   * @param name - The name for the API key
   * @param expires - Optional expiration timestamp
   * @param options - Operation options including abort signal
   * @returns The created API key (including secret - only returned once)
   */
  async createApiKeyForServiceUser(
    user: string,
    name: string,
    expires?: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { user, name };
    if (expires !== undefined) {
      params.expires = expires;
    }
    const response = await this.client.write('CreateApiKeyForServiceUser' as never, params as never);
    return response;
  }

  /**
   * Deletes an API key for a service user.
   *
   * @param user - The service user name or ID
   * @param key - The API key ID to delete
   * @param options - Operation options including abort signal
   * @returns The deletion result
   */
  async deleteApiKeyForServiceUser(user: string, key: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteApiKeyForServiceUser' as never, { user, key } as never);
    return response;
  }
}
