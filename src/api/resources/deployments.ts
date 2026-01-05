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
}
