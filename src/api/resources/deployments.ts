import { BaseResource } from '../base.js';
import { KomodoDeployment, KomodoDeploymentListItem, KomodoUpdate } from '../types.js';

/**
 * Resource for managing Deployments.
 */
export class DeploymentResource extends BaseResource {
  /**
   * Lists all configured deployments.
   *
   * @returns A list of deployment items
   */
  async list(): Promise<KomodoDeploymentListItem[]> {
    try {
      const response = await this.client.read('ListDeployments', {});
      return response || [];
    } catch (error) {
      this.logger.error('Failed to list deployments:', error);
      return [];
    }
  }

  /**
   * Gets detailed information about a specific deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The deployment details
   */
  async get(deploymentId: string): Promise<KomodoDeployment> {
    try {
      const response = await this.client.read('GetDeployment', { deployment: deploymentId });
      return response;
    } catch (error) {
      this.logger.error(`Failed to get deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new deployment.
   *
   * @param name - The name for the new deployment
   * @param config - Optional partial deployment configuration
   * @returns The created deployment
   */
  async create(name: string, config?: Record<string, unknown>): Promise<KomodoDeployment> {
    try {
      const response = await this.client.write('CreateDeployment', {
        name,
        config,
      });
      return response as KomodoDeployment;
    } catch (error) {
      this.logger.error('Failed to create deployment:', error);
      throw error;
    }
  }

  /**
   * Updates an existing deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param config - The partial deployment configuration to apply
   * @returns The updated deployment
   */
  async update(deploymentId: string, config: Record<string, unknown>): Promise<KomodoDeployment> {
    try {
      const response = await this.client.write('UpdateDeployment', {
        id: deploymentId,
        config,
      });
      return response as KomodoDeployment;
    } catch (error) {
      this.logger.error(`Failed to update deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The deleted deployment
   */
  async delete(deploymentId: string): Promise<KomodoDeployment> {
    try {
      const response = await this.client.write('DeleteDeployment', { id: deploymentId });
      return response as KomodoDeployment;
    } catch (error) {
      this.logger.error(`Failed to delete deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Triggers a deployment.
   *
   * @param deploymentId - The ID or name of the deployment to trigger
   * @returns The update status
   */
  async deploy(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('Deploy', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to deploy container ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Pulls the latest image for a deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async pull(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('PullDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to pull image for deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Starts a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async start(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('StartDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to start deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Restarts a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async restart(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('RestartDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to restart deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Pauses a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async pause(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('PauseDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to pause deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Unpauses a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async unpause(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('UnpauseDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to unpause deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Stops a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async stop(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('StopDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to stop deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Destroys (removes) a deployment container.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The update status
   */
  async destroy(deploymentId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('DestroyDeployment', {
        deployment: deploymentId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to destroy deployment ${deploymentId}:`, error);
      throw error;
    }
  }
}
