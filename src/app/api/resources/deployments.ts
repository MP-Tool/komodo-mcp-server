/**
 * Deployment Resource
 *
 * Provides operations for managing Komodo deployments.
 * Supports full lifecycle management: create, deploy, start, stop, restart,
 * pause, unpause, pull, and destroy.
 *
 * @module app/api/resources/deployments
 */

import { BaseResource, validateDeploymentId, validateResourceName } from '../index.js';
import type { ApiOperationOptions } from '../base.js';
import type { Types } from 'komodo_client';

// Type aliases for Komodo types
type DeploymentListItem = Types.DeploymentListItem;
type Deployment = Types.Deployment;
type DeploymentConfig = Types.DeploymentConfig;
type Update = Types.Update;

/**
 * Resource for managing Deployments.
 */
export class DeploymentResource extends BaseResource {
  /**
   * Lists all configured deployments.
   *
   * @param options - Operation options including abort signal
   * @returns A list of deployment items
   * @throws Error on API failure or cancellation
   */
  async list(options?: ApiOperationOptions): Promise<DeploymentListItem[]> {
    this.checkAborted(options?.signal);
    const response = await this.client.read('ListDeployments', {});
    return response || [];
  }

  /**
   * Gets detailed information about a specific deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The deployment details
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async get(deploymentId: string, options?: ApiOperationOptions): Promise<Deployment> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.read('GetDeployment', { deployment: deploymentId });
    return response;
  }

  /**
   * Creates a new deployment.
   *
   * @param name - The name for the new deployment
   * @param config - Optional partial deployment configuration
   * @param options - Operation options including abort signal
   * @returns The created deployment
   * @throws ZodError if name is invalid
   * @throws Error on API failure or cancellation
   */
  async create(name: string, config?: Partial<DeploymentConfig>, options?: ApiOperationOptions): Promise<Deployment> {
    validateResourceName(name);
    this.checkAborted(options?.signal);
    const response = await this.client.write('CreateDeployment', {
      name,
      config,
    });
    return response;
  }

  /**
   * Updates an existing deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param config - The partial deployment configuration to apply
   * @param options - Operation options including abort signal
   * @returns The updated deployment
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async update(
    deploymentId: string,
    config: Partial<DeploymentConfig>,
    options?: ApiOperationOptions,
  ): Promise<Deployment> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.write('UpdateDeployment', {
      id: deploymentId,
      config,
    });
    return response;
  }

  /**
   * Deletes a deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The deleted deployment
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(deploymentId: string, options?: ApiOperationOptions): Promise<Deployment> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.write('DeleteDeployment', { id: deploymentId });
    return response;
  }

  /**
   * Triggers a deployment.
   *
   * @param deploymentId - The ID or name of the deployment to trigger
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async deploy(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('Deploy', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Pulls the latest image for a deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async pull(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('PullDeployment', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Starts a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async start(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('StartDeployment', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Restarts a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async restart(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('RestartDeployment', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Pauses a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async pause(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('PauseDeployment', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Unpauses a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async unpause(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('UnpauseDeployment', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Stops a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async stop(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('StopDeployment', {
      deployment: deploymentId,
    });
    return response;
  }

  /**
   * Destroys (removes) a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if deploymentId is invalid
   * @throws Error on API failure or cancellation
   */
  async destroy(deploymentId: string, options?: ApiOperationOptions): Promise<Update> {
    validateDeploymentId(deploymentId);
    this.checkAborted(options?.signal);
    const response = await this.client.execute('DestroyDeployment', {
      deployment: deploymentId,
    });
    return response;
  }
}
