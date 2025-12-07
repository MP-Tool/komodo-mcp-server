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
   * Gets detailed information about a specific stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The stack details
   */
  async get(stackId: string): Promise<any> {
    try {
      const response = await this.client.read('GetStack', { stack: stackId });
      return response;
    } catch (error) {
      this.logger.error(`Failed to get stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Creates a new stack.
   *
   * @param config - The stack configuration
   * @returns The created stack
   */
  async create(config: any): Promise<any> {
    try {
      // @ts-ignore - CreateStack is valid but types might be desynced
      const response = await this.client.execute('CreateStack', config);
      return response;
    } catch (error) {
      this.logger.error('Failed to create stack:', error);
      throw error;
    }
  }

  /**
   * Updates an existing stack.
   *
   * @param stackId - The ID or name of the stack
   * @param config - The new stack configuration
   * @returns The updated stack
   */
  async update(stackId: string, config: any): Promise<any> {
    try {
      // @ts-ignore - UpdateStack is valid but types might be desynced
      const response = await this.client.execute('UpdateStack', {
        stack: stackId,
        ...config,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to update stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The result of the deletion
   */
  async delete(stackId: string): Promise<void> {
    try {
      // @ts-ignore - DeleteStack is valid but types might be desynced
      await this.client.execute('DeleteStack', { stack: stackId });
    } catch (error) {
      this.logger.error(`Failed to delete stack ${stackId}:`, error);
      throw error;
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
        stack: stackId,
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
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to stop stack ${stackId}:`, error);
      throw error;
    }
  }
}
