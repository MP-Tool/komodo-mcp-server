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
