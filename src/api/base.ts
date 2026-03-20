import { KomodoClient as CoreClient } from 'komodo_client';
import { logger as baseLogger } from '../framework.js';

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
 * Network error codes that indicate transient failures.
 * These are standard Node.js/system error codes.
 */
export const RETRYABLE_NETWORK_ERROR_CODES = [
  'ECONNREFUSED', // Connection refused - server not listening
  'ETIMEDOUT', // Connection timed out
  'ECONNRESET', // Connection reset by peer
  'ENOTFOUND', // DNS lookup failed
  'ENETUNREACH', // Network unreachable
  'EHOSTUNREACH', // Host unreachable
  'EPIPE', // Broken pipe
  'EAI_AGAIN', // DNS temporary failure
] as const;

/**
 * Interface for errors with a code property (Node.js system errors).
 */
export interface ErrorWithCode extends Error {
  code?: string;
}

/**
 * Interface for errors with HTTP status (Axios/fetch errors).
 */
export interface ErrorWithStatus extends Error {
  status?: number;
  response?: {
    status?: number;
  };
}

/**
 * Type guard to check if an error has a code property.
 */
export function isErrorWithCode(error: unknown): error is ErrorWithCode {
  return error instanceof Error && 'code' in error && typeof (error as ErrorWithCode).code === 'string';
}

/**
 * Type guard to check if an error has HTTP status information.
 */
export function isErrorWithStatus(error: unknown): error is ErrorWithStatus {
  if (!(error instanceof Error)) return false;
  const err = error as ErrorWithStatus;
  return typeof err.status === 'number' || typeof err.response?.status === 'number';
}

/**
 * Extracts HTTP status code from various error formats.
 */
export function getErrorStatusCode(error: unknown): number | undefined {
  if (!isErrorWithStatus(error)) return undefined;
  return error.status ?? error.response?.status;
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
  /** Maximum jitter to add to delay (percentage, 0-1) */
  jitterFactor: number;
}

/**
 * Default retry configuration.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  exponentialBackoff: true,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  jitterFactor: 0.2, // Add up to 20% jitter
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

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateRetryDelay(attempt, retryConfig);

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
   * Checks if an error is retryable based on error codes and status codes.
   *
   * Uses proper type-safe error code inspection instead of string matching.
   */
  private isRetryableError(error: unknown, retryableStatusCodes: number[]): boolean {
    // Check for network errors using error code property (type-safe)
    if (isErrorWithCode(error)) {
      const errorCode = error.code;
      if (errorCode && (RETRYABLE_NETWORK_ERROR_CODES as readonly string[]).includes(errorCode)) {
        return true;
      }
    }

    // Check for HTTP status codes using proper status extraction
    const statusCode = getErrorStatusCode(error);
    if (statusCode !== undefined && retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Calculates delay with optional exponential backoff and jitter.
   *
   * Jitter helps prevent thundering herd problems when multiple
   * clients retry simultaneously.
   */
  private calculateRetryDelay(attempt: number, config: RetryConfig): number {
    // Calculate base delay with optional exponential backoff
    const baseDelay = config.exponentialBackoff ? config.baseDelayMs * Math.pow(2, attempt) : config.baseDelayMs;

    // Add jitter to prevent thundering herd
    const jitter = baseDelay * config.jitterFactor * Math.random();

    return Math.floor(baseDelay + jitter);
  }

  /**
   * Sleep helper for retry delays.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
