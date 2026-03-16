/**
 * User Resource
 *
 * Provides operations for managing Users and User Groups in Komodo.
 * Includes user CRUD, service accounts, and user group membership management.
 *
 * @module app/api/resources/users
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for managing Users and User Groups.
 */
export class UserResource extends BaseResource {
  // ============================================================================
  // User Operations
  // ============================================================================

  /**
   * Lists all users.
   *
   * @param options - Operation options including abort signal
   * @returns A list of users
   */
  async list(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListUsers' as never, {} as never);
    return response;
  }

  /**
   * Finds a user by username or ID.
   *
   * @param user - Username or user ID to find
   * @param options - Operation options including abort signal
   * @returns The user details
   */
  async find(user: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('FindUser' as never, { user } as never);
    return response;
  }

  /**
   * Gets the username for a given user ID.
   *
   * @param userId - The user ID to look up
   * @param options - Operation options including abort signal
   * @returns The username
   */
  async getUsername(userId: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetUsername' as never, { user_id: userId } as never);
    return response;
  }

  /**
   * Creates a new service user (service account).
   *
   * @param username - The username for the service account
   * @param description - Optional description
   * @param options - Operation options including abort signal
   * @returns The created service user
   */
  async createServiceUser(username: string, description?: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const params: Record<string, unknown> = { username };
    if (description !== undefined) {
      params.description = description;
    }
    const response = await this.client.write('CreateServiceUser' as never, params as never);
    return response;
  }

  /**
   * Deletes a user by ID.
   *
   * @param id - The user ID to delete
   * @param options - Operation options including abort signal
   * @returns The deletion result
   */
  async delete(id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteUser' as never, { id } as never);
    return response;
  }

  /**
   * Updates a user's username.
   *
   * @param id - The user ID
   * @param username - The new username
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateUsername(id: string, username: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateUserUsername' as never, { id, username } as never);
    return response;
  }

  /**
   * Updates a user's password.
   *
   * @param id - The user ID
   * @param password - The new password
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updatePassword(id: string, password: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateUserPassword' as never, { id, password } as never);
    return response;
  }

  /**
   * Updates a service user's description.
   *
   * @param id - The service user ID
   * @param description - The new description
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateServiceUserDescription(id: string, description: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateServiceUserDescription' as never, { id, description } as never);
    return response;
  }

  /**
   * Toggles admin status for a user.
   *
   * @param userId - The user ID
   * @param admin - Whether the user should be an admin
   * @param options - Operation options including abort signal
   * @returns The update result
   */
  async updateAdmin(userId: string, admin: boolean, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateUserAdmin' as never, { user_id: userId, admin } as never);
    return response;
  }

  // ============================================================================
  // User Group Operations
  // ============================================================================

  /**
   * Lists all user groups.
   *
   * @param options - Operation options including abort signal
   * @returns A list of user groups
   */
  async listGroups(options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListUserGroups' as never, {} as never);
    return response;
  }

  /**
   * Gets detailed information about a specific user group.
   *
   * @param userGroup - The user group name or ID
   * @param options - Operation options including abort signal
   * @returns The user group details
   */
  async getGroup(userGroup: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetUserGroup' as never, { user_group: userGroup } as never);
    return response;
  }

  /**
   * Creates a new user group.
   *
   * @param name - The name for the new group
   * @param options - Operation options including abort signal
   * @returns The created user group
   */
  async createGroup(name: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateUserGroup' as never, { name } as never);
    return response;
  }

  /**
   * Renames a user group.
   *
   * @param id - The user group ID
   * @param name - The new name
   * @param options - Operation options including abort signal
   * @returns The rename result
   */
  async renameGroup(id: string, name: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('RenameUserGroup' as never, { id, name } as never);
    return response;
  }

  /**
   * Deletes a user group.
   *
   * @param id - The user group ID
   * @param options - Operation options including abort signal
   * @returns The deletion result
   */
  async deleteGroup(id: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteUserGroup' as never, { id } as never);
    return response;
  }

  /**
   * Adds a user to a user group.
   *
   * @param userGroup - The user group name or ID
   * @param user - The user name or ID to add
   * @param options - Operation options including abort signal
   * @returns The result
   */
  async addUserToGroup(userGroup: string, user: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write('AddUserToUserGroup' as never, { user_group: userGroup, user } as never);
    return response;
  }

  /**
   * Removes a user from a user group.
   *
   * @param userGroup - The user group name or ID
   * @param user - The user name or ID to remove
   * @param options - Operation options including abort signal
   * @returns The result
   */
  async removeUserFromGroup(userGroup: string, user: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.write(
      'RemoveUserFromUserGroup' as never,
      { user_group: userGroup, user } as never,
    );
    return response;
  }
}
