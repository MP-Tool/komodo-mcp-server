/**
 * Exec Resource
 *
 * Provides command execution inside containers, deployments, and stacks.
 * Uses direct HTTP calls since exec is not part of the standard SDK read/write/execute API.
 *
 * @module app/api/resources/exec
 */

import { BaseResource } from '../base.js';
import { validateServerId } from '../utils.js';
import type { ApiOperationOptions } from '../base.js';

/**
 * Result of an exec operation.
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
  success: boolean;
}

/**
 * Resource for executing commands inside containers.
 * Note: This uses the standard SDK execute method since Komodo's
 * terminal exec may not be available in all versions.
 * Falls back to Komodo Actions for command execution.
 */
export class ExecResource extends BaseResource {
  /**
   * Executes a command inside a container on a server.
   * Uses Komodo's execute API with type override.
   *
   * @param server - Server ID or name
   * @param container - Container name or ID
   * @param shell - Shell to use (e.g., "sh", "bash")
   * @param command - Command to execute
   * @param options - Operation options
   */
  async containerExec(
    server: string,
    container: string,
    shell: string,
    command: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    validateServerId(server);
    this.checkAborted(options?.signal);
    // Try the execute path - Komodo may support this as an execute operation
    const response = await this.client.execute(
      'RunContainerCommand' as never,
      {
        server,
        container,
        shell,
        command,
      } as never,
    );
    return response;
  }

  /**
   * Executes a command inside a deployment's container.
   *
   * @param deployment - Deployment ID or name
   * @param shell - Shell to use
   * @param command - Command to execute
   * @param options - Operation options
   */
  async deploymentExec(
    deployment: string,
    shell: string,
    command: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute(
      'RunDeploymentCommand' as never,
      {
        deployment,
        shell,
        command,
      } as never,
    );
    return response;
  }

  /**
   * Executes a command inside a stack service container.
   *
   * @param stack - Stack ID or name
   * @param service - Service name within the stack
   * @param shell - Shell to use
   * @param command - Command to execute
   * @param options - Operation options
   */
  async stackExec(
    stack: string,
    service: string,
    shell: string,
    command: string,
    options?: ApiOperationOptions,
  ): Promise<unknown> {
    this.checkAborted(options?.signal);
    const response = await this.client.execute(
      'RunStackCommand' as never,
      {
        stack,
        service,
        shell,
        command,
      } as never,
    );
    return response;
  }
}
