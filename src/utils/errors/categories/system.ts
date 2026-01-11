/**
 * System Error Classes
 *
 * Errors related to internal system operations:
 * - InternalError: Internal server errors
 * - RegistryError: Registration/registry errors
 *
 * @module errors/categories/system
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from '../core/base.js';
import { ErrorCodes, type BaseErrorOptions } from '../core/types.js';
import { getMessage } from '../core/messages.js';
import { HttpStatus } from '../core/constants.js';

// ============================================================================
// Internal Error
// ============================================================================

/**
 * Error thrown for internal server errors.
 *
 * @example
 * ```typescript
 * throw new InternalError('Unexpected state');
 *
 * // With error reference ID
 * throw InternalError.withId('abc123');
 * ```
 */
export class InternalError extends AppError {
  /** Optional user-friendly reference ID for support (separate from errorId UUID) */
  readonly referenceId?: string;

  constructor(
    message: string = getMessage('INTERNAL_ERROR'),
    options: Omit<BaseErrorOptions, 'code'> & { referenceId?: string } = {},
  ) {
    super(message, {
      code: ErrorCodes.INTERNAL_ERROR,
      statusCode: options.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        referenceId: options.referenceId,
      },
    });

    this.referenceId = options.referenceId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an InternalError with a user-friendly reference ID.
   */
  static withId(referenceId: string): InternalError {
    return new InternalError(getMessage('INTERNAL_ERROR_WITH_ID', { errorId: referenceId }), {
      referenceId,
      recoveryHint: `Please report this error with reference ID: ${referenceId}.`,
    });
  }

  /**
   * Create an unexpected error.
   */
  static unexpected(cause?: Error): InternalError {
    return new InternalError(getMessage('UNEXPECTED_ERROR'), {
      cause,
      recoveryHint: 'An unexpected error occurred. Please try again or report this issue.',
    });
  }

  /**
   * Create a not implemented error.
   */
  static notImplemented(): InternalError {
    return new InternalError(getMessage('NOT_IMPLEMENTED'), {
      recoveryHint: 'This feature is not yet implemented.',
    });
  }

  /**
   * Create a service unavailable error.
   */
  static serviceUnavailable(): InternalError {
    return new InternalError(getMessage('SERVICE_UNAVAILABLE'), {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      recoveryHint: 'The service is temporarily unavailable. Please try again later.',
    });
  }
}

// ============================================================================
// Registry Error
// ============================================================================

/**
 * Error thrown for registry operations (tools, resources, prompts).
 *
 * @example
 * ```typescript
 * throw RegistryError.duplicate('Tool', 'my_tool');
 * throw RegistryError.notFound('Resource', 'my_resource');
 * ```
 */
export class RegistryError extends AppError {
  /** The type of item (Tool, Resource, Prompt) */
  readonly itemType: string;

  /** The name of the item */
  readonly itemName: string;

  constructor(itemType: string, itemName: string, message: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.INTERNAL_ERROR,
      statusCode: options.statusCode ?? HttpStatus.INTERNAL_SERVER_ERROR,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        itemType,
        itemName,
      },
    });

    this.itemType = itemType;
    this.itemName = itemName;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create an error for duplicate registration.
   */
  static duplicate(itemType: string, itemName: string): RegistryError {
    return new RegistryError(itemType, itemName, getMessage('REGISTRY_DUPLICATE', { itemType, itemName }), {
      recoveryHint: `A ${itemType.toLowerCase()} named '${itemName}' already exists. Use a unique name.`,
    });
  }

  /**
   * Create an error for item not found.
   */
  static notFound(itemType: string, itemName: string): RegistryError {
    return new RegistryError(itemType, itemName, getMessage('REGISTRY_NOT_FOUND', { itemType, itemName }), {
      statusCode: HttpStatus.NOT_FOUND,
      recoveryHint: `Check that the ${itemType.toLowerCase()} '${itemName}' is registered.`,
    });
  }

  /**
   * Create an error for tool not available.
   */
  static toolNotAvailable(toolName: string): RegistryError {
    return new RegistryError('Tool', toolName, getMessage('TOOL_NOT_AVAILABLE', { toolName }), {
      recoveryHint: 'Check that the tool is installed and configured correctly.',
    });
  }

  /**
   * Create an error for tool requiring connection.
   */
  static toolRequiresConnection(toolName: string): RegistryError {
    return new RegistryError('Tool', toolName, getMessage('TOOL_REQUIRES_CONNECTION', { toolName }), {
      recoveryHint: 'Use komodo_configure to connect to a Komodo server first.',
    });
  }
}
