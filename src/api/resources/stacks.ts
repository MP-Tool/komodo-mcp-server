import { BaseResource } from '../base.js';
import { KomodoStackListItem, KomodoUpdate } from '../types.js';

/**
 * Resource for managing Docker Compose Stacks.
 */
export class StackResource extends BaseResource {
  /**
   * Lists all configured stacks.
   * 
   * @returns A list of stack items
   */
  async list(): Promise<KomodoStackListItem[]> {
    try {
      const response = await this.client.read('ListStacks', {});
      return response || [];
    } catch (error) {
      this.logger.error('Failed to list stacks:', error);
      return [];
    }
  }

  /**
   * Deploys (starts/updates) a stack.
   * 
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async deploy(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('DeployStack', {
        stack: stackId
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to deploy stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Stops a stack.
   * 
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async stop(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('StopStack', {
        stack: stackId
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to stop stack ${stackId}:`, error);
      throw error;
    }
  }
}
