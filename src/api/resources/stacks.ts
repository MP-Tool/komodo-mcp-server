import { BaseResource, ApiOperationOptions } from '../base.js';
import { KomodoStack, KomodoStackListItem, KomodoUpdate } from '../types.js';
import { validateStackId, validateResourceName } from '../utils.js';

/**
 * Resource for managing Docker Compose Stacks.
 */
export class StackResource extends BaseResource {
  /**
   * Lists all configured stacks.
   *
   * @param options - Operation options including abort signal
   * @returns A list of stack items
   * @throws Error on API failure or cancellation
   */
  async list(options?: ApiOperationOptions): Promise<KomodoStackListItem[]> {
    this.checkAborted(options?.signal);

    const response = await this.client.read('ListStacks', {});
    return response || [];
  }

  /**
   * Gets detailed information about a specific stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The stack details
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async get(stackId: string, options?: ApiOperationOptions): Promise<KomodoStack> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.read('GetStack', { stack: stackId });
    return response;
  }

  /**
   * Creates a new stack.
   *
   * @param name - The name for the new stack
   * @param config - Optional partial stack configuration
   * @param options - Operation options including abort signal
   * @returns The created stack
   * @throws ZodError if name is invalid
   * @throws Error on API failure or cancellation
   */
  async create(name: string, config?: Record<string, unknown>, options?: ApiOperationOptions): Promise<KomodoStack> {
    validateResourceName(name);
    this.checkAborted(options?.signal);

    const response = await this.client.write('CreateStack', {
      name,
      config,
    });
    return response as KomodoStack;
  }

  /**
   * Updates an existing stack.
   *
   * @param stackId - The ID or name of the stack
   * @param config - The partial stack configuration to apply
   * @param options - Operation options including abort signal
   * @returns The updated stack
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async update(stackId: string, config: Record<string, unknown>, options?: ApiOperationOptions): Promise<KomodoStack> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.write('UpdateStack', {
      id: stackId,
      config,
    });
    return response as KomodoStack;
  }

  /**
   * Deletes a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The deleted stack
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async delete(stackId: string, options?: ApiOperationOptions): Promise<KomodoStack> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.write('DeleteStack', { id: stackId });
    return response as KomodoStack;
  }

  /**
   * Deploys (starts/updates) a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async deploy(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('DeployStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Pulls the latest images for a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async pull(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('PullStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Starts a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async start(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('StartStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Restarts a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async restart(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('RestartStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Pauses a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async pause(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('PauseStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Unpauses a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async unpause(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('UnpauseStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Stops a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async stop(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('StopStack', {
      stack: stackId,
    });
    return response;
  }

  /**
   * Destroys (removes) all containers of a stack.
   *
   * @param stackId - The ID or name of the stack
   * @param options - Operation options including abort signal
   * @returns The update status
   * @throws ZodError if stackId is invalid
   * @throws Error on API failure or cancellation
   */
  async destroy(stackId: string, options?: ApiOperationOptions): Promise<KomodoUpdate> {
    validateStackId(stackId);
    this.checkAborted(options?.signal);

    const response = await this.client.execute('DestroyStack', {
      stack: stackId,
    });
    return response;
  }
}
