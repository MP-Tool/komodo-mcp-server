import { KomodoClient as CoreClient } from 'komodo_client';
import { logger as baseLogger } from '../utils/index.js';

/**
 * Operation types for timeout configuration.
 */
export type OperationType = 'list' | 'get' | 'create' | 'update' | 'delete' | 'action' | 'logs';

/**
 * Default timeouts for different operation types (in milliseconds).
 */
export const OPERATION_TIMEOUTS: Record<OperationType, number> = {
  list: 10_000, // 10 seconds for list operations
  get: 10_000, // 10 seconds for single resource fetch
  create: 30_000, // 30 seconds for create operations
  update: 30_000, // 30 seconds for update operations
  delete: 30_000, // 30 seconds for delete operations
  action: 300_000, // 5 minutes for long-running actions (deploy, etc.)
  logs: 60_000, // 1 minute for log retrieval
};

/**
 * Options for API operations that support cancellation and timeouts.
 */
export interface ApiOperationOptions {
  /** AbortSignal for cancellation support */
  signal?: AbortSignal;
  /** Operation type for timeout configuration */
  operationType?: OperationType;
  /** Custom timeout in milliseconds (overrides default for operationType) */
  timeout?: number;
}

/**
 * Retry configuration for transient errors.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs: number;
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  exponentialBackoff: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Result of a validation function.
 */
type ValidationFunction = (value: string) => void;

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

  /**
   * Helper to validate input and check for abort in one call.
   * Reduces boilerplate in resource methods.
   *
   * @param value - The value to validate
   * @param validator - The validation function to apply
   * @param options - Operation options including abort signal
   * @throws ZodError if validation fails
   * @throws AbortError if signal is aborted
   *
   * @example
   * ```typescript
   * async get(stackId: string, options?: ApiOperationOptions) {
   *   this.withValidation(stackId, validateStackId, options);
   *   // ... rest of method
   * }
   * ```
   */
  protected withValidation(value: string, validator: ValidationFunction, options?: ApiOperationOptions): void {
    validator(value);
    this.checkAborted(options?.signal);
  }

  /**
   * Gets the timeout for an operation type.
   *
   * @param options - Operation options that may include custom timeout
   * @param defaultType - Default operation type if not specified
   * @returns Timeout in milliseconds
   */
  protected getTimeout(options?: ApiOperationOptions, defaultType: OperationType = 'get'): number {
    if (options?.timeout) {
      return options.timeout;
    }
    return OPERATION_TIMEOUTS[options?.operationType ?? defaultType];
  }

  /**
   * Wraps an API call with retry logic for transient failures.
   *
   * @param operation - The async operation to execute
   * @param config - Retry configuration (optional, uses defaults)
   * @param operationName - Name of the operation for logging
   * @returns The result of the operation
   *
   * @example
   * ```typescript
   * const result = await this.withRetry(
   *   () => this.client.read('GetServer', { server: id }),
   *   { maxRetries: 3 },
   *   'GetServer'
   * );
   * ```
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    config: Partial<RetryConfig> = {},
    operationName?: string,
  ): Promise<T> {
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        const isRetryable = this.isRetryableError(error, retryConfig.retryableStatusCodes);

        if (!isRetryable || attempt >= retryConfig.maxRetries) {
          throw error;
        }

        // Calculate delay with optional exponential backoff
        const delay = retryConfig.exponentialBackoff
          ? retryConfig.baseDelayMs * Math.pow(2, attempt)
          : retryConfig.baseDelayMs;

        this.logger.warn(
          `${operationName ?? 'Operation'} failed (attempt ${attempt + 1}/${retryConfig.maxRetries + 1}), ` +
            `retrying in ${delay}ms: ${(error as Error).message}`,
        );

        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError ?? new Error('Retry failed');
  }

  /**
   * Checks if an error is retryable based on status codes.
   */
  private isRetryableError(error: unknown, retryableStatusCodes: number[]): boolean {
    if (error instanceof Error) {
      // Check for network errors
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
        return true;
      }

      // Check for HTTP status codes in error message
      for (const code of retryableStatusCodes) {
        if (error.message.includes(String(code))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Sleep helper for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
