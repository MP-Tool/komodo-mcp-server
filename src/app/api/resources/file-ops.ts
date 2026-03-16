/**
 * File Operations Resource
 *
 * Provides operations for writing file contents to stacks, builds, and syncs,
 * as well as refreshing caches for various resource types.
 *
 * @module app/api/resources/file-ops
 */

import { BaseResource } from '../base.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Resource for file content writes and cache refresh operations.
 */
export class FileOpsResource extends BaseResource {
  /**
   * Writes file contents to a stack.
   *
   * @param stack - Stack ID or name
   * @param filePath - Path of the file within the stack
   * @param contents - File contents to write
   * @param options - Operation options including abort signal
   * @returns The write result
   */
  async writeStackFileContents(
    stack: string,
    filePath: string,
    contents: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'WriteStackFileContents' as never,
      {
        stack,
        file_path: filePath,
        contents,
      } as never,
    );
  }

  /**
   * Writes file contents to a build.
   *
   * @param build - Build ID or name
   * @param contents - File contents to write
   * @param options - Operation options including abort signal
   * @returns The write result
   */
  async writeBuildFileContents(build: string, contents: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'WriteBuildFileContents' as never,
      {
        build,
        contents,
      } as never,
    );
  }

  /**
   * Writes file contents to a resource sync.
   *
   * @param sync - Sync ID or name
   * @param resourcePath - Resource path within the sync
   * @param filePath - Path of the file
   * @param contents - File contents to write
   * @param options - Operation options including abort signal
   * @returns The write result
   */
  async writeSyncFileContents(
    sync: string,
    resourcePath: string,
    filePath: string,
    contents: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write(
      'WriteSyncFileContents' as never,
      {
        sync,
        resource_path: resourcePath,
        file_path: filePath,
        contents,
      } as never,
    );
  }

  /**
   * Refreshes the cache for a stack.
   *
   * @param stack - Stack ID or name
   * @param options - Operation options including abort signal
   * @returns The refresh result
   */
  async refreshStackCache(stack: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('RefreshStackCache' as never, { stack } as never);
  }

  /**
   * Refreshes the cache for a build.
   *
   * @param build - Build ID or name
   * @param options - Operation options including abort signal
   * @returns The refresh result
   */
  async refreshBuildCache(build: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('RefreshBuildCache' as never, { build } as never);
  }

  /**
   * Refreshes the cache for a repo.
   *
   * @param repo - Repo ID or name
   * @param options - Operation options including abort signal
   * @returns The refresh result
   */
  async refreshRepoCache(repo: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('RefreshRepoCache' as never, { repo } as never);
  }

  /**
   * Refreshes pending state for a resource sync.
   *
   * @param sync - Sync ID or name
   * @param options - Operation options including abort signal
   * @returns The refresh result
   */
  async refreshResourceSyncPending(sync: string, options?: ApiOperationOptions): Promise<unknown> {
    this.checkAborted(options?.signal);
    return await this.client.write('RefreshResourceSyncPending' as never, { sync } as never);
  }
}
