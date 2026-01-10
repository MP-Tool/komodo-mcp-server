import { KomodoClient as CoreClient } from 'komodo_client';
import { logger as baseLogger } from '../utils/index.js';

/**
 * Options for API operations that support cancellation.
 */
export interface ApiOperationOptions {
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
}

/**
 * Abstract base class for API resources.
 *
 * Provides access to the core Komodo client and a scoped logger.
 */
export abstract class BaseResource {
  protected client: ReturnType<typeof CoreClient>;
  protected logger;

  /**
   * @param client - The initialized core Komodo client
   */
  constructor(client: ReturnType<typeof CoreClient>) {
    this.client = client;
    this.logger = baseLogger.child({ component: this.constructor.name });
  }

  /**
   * Checks if operation was cancelled via AbortSignal.
   * @throws Error if signal is aborted
   */
  protected checkAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      const error = new Error('Operation cancelled');
      error.name = 'AbortError';
      throw error;
    }
  }
}
