import { BaseResource } from '../base.js';
import { KomodoStack, KomodoStackListItem, KomodoUpdate } from '../types.js';

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
  async get(stackId: string): Promise<KomodoStack> {
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
   * @param name - The name for the new stack
   * @param config - Optional partial stack configuration
   * @returns The created stack
   */
  async create(name: string, config?: Record<string, unknown>): Promise<KomodoStack> {
    try {
      const response = await this.client.write('CreateStack', {
        name,
        config,
      });
      return response as KomodoStack;
    } catch (error) {
      this.logger.error('Failed to create stack:', error);
      throw error;
    }
  }

  /**
   * Updates an existing stack.
   *
   * @param stackId - The ID or name of the stack
   * @param config - The partial stack configuration to apply
   * @returns The updated stack
   */
  async update(stackId: string, config: Record<string, unknown>): Promise<KomodoStack> {
    try {
      const response = await this.client.write('UpdateStack', {
        id: stackId,
        config,
      });
      return response as KomodoStack;
    } catch (error) {
      this.logger.error(`Failed to update stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Deletes a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The deleted stack
   */
  async delete(stackId: string): Promise<KomodoStack> {
    try {
      const response = await this.client.write('DeleteStack', { id: stackId });
      return response as KomodoStack;
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
