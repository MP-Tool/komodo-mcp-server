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
   * Pulls the latest images for a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async pull(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('PullStack', {
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to pull images for stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Starts a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async start(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('StartStack', {
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to start stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Restarts a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async restart(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('RestartStack', {
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to restart stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Pauses a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async pause(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('PauseStack', {
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to pause stack ${stackId}:`, error);
      throw error;
    }
  }

  /**
   * Unpauses a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async unpause(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('UnpauseStack', {
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to unpause stack ${stackId}:`, error);
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

  /**
   * Destroys (removes) all containers of a stack.
   *
   * @param stackId - The ID or name of the stack
   * @returns The update status
   */
  async destroy(stackId: string): Promise<KomodoUpdate> {
    try {
      const response = await this.client.execute('DestroyStack', {
        stack: stackId,
      });
      return response;
    } catch (error) {
      this.logger.error(`Failed to destroy stack ${stackId}:`, error);
      throw error;
    }
  }
}
