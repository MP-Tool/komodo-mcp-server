import { BaseResource } from '../base.js';
import { KomodoDeploymentListItem, KomodoUpdate } from '../types.js';

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
  async get(deploymentId: string): Promise<any> {
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
   * @param config - The deployment configuration
   * @returns The created deployment
   */
  async create(config: any): Promise<any> {
    try {
      // @ts-ignore - CreateDeployment is valid but types might be desynced
      const response = await this.client.execute('CreateDeployment', config);
      return response;
    } catch (error) {
      this.logger.error('Failed to create deployment:', error);
      throw error;
    }
  }

  /**
   * Updates an existing deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @param config - The new deployment configuration
   * @returns The updated deployment
   */
  async update(deploymentId: string, config: any): Promise<any> {
    try {
      // @ts-ignore - UpdateDeployment is valid but types might be desynced
      const response = await this.client.execute('UpdateDeployment', {
        deployment: deploymentId,
        ...config,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to update deployment ${deploymentId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a deployment.
   *
   * @param deploymentId - The ID or name of the deployment
   * @returns The result of the deletion
   */
  async delete(deploymentId: string): Promise<void> {
    try {
      // @ts-ignore - DeleteDeployment is valid but types might be desynced
      await this.client.execute('DeleteDeployment', { deployment: deploymentId });
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
