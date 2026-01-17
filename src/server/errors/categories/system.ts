/**
 * System Error Classes
 *
 * Errors related to internal system failures:
 * - InternalError: Unexpected internal errors
 * - RegistryError: Tool/resource registry errors
 *
 * @module server/errors/categories/system
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError, ErrorCodes, getFrameworkMessage } from '../core/index.js';
import type { BaseErrorOptions } from '../core/index.js';

// ============================================================================
// Internal Error
// ============================================================================

/**
 * Error for unexpected internal failures.
 *
 * Use this for errors that shouldn't happen in normal operation
 * and indicate bugs or system failures.
 *
 * @example
 * ```typescript
 * throw new InternalError('Unexpected state in request handler');
 *
 * // Wrap unexpected errors
 * catch (err) {
 *   throw InternalError.wrap(err, 'Failed to process request');
 * }
 * ```
 */
export class InternalError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.INTERNAL_ERROR,
      statusCode: 500,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint || 'This is an internal error. Please try again or contact support.',
      context: options.context,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Wrap an unknown error in an InternalError.
   */
  static wrap(error: unknown, context?: string): InternalError {
    const message = context
      ? `${context}: ${error instanceof Error ? error.message : String(error)}`
      : error instanceof Error
        ? error.message
        : String(error);

    return new InternalError(message, {
      cause: error instanceof Error ? error : undefined,
    });
  }

  /**
   * Create an InternalError for an unexpected state.
   */
  static unexpectedState(description: string): InternalError {
    return new InternalError(getFrameworkMessage('INTERNAL_UNEXPECTED_STATE', { description }), {
      recoveryHint: 'This indicates a bug. Please report this issue.',
    });
  }

  /**
   * Create an InternalError for missing implementation.
   */
  static notImplemented(feature: string): InternalError {
    return new InternalError(getFrameworkMessage('INTERNAL_NOT_IMPLEMENTED', { feature }), {
      recoveryHint: `The feature '${feature}' is not yet implemented.`,
    });
  }
}

// ============================================================================
// Registry Error
// ============================================================================

/**
 * Error for tool/resource registry operations.
 *
 * Used when registering, unregistering, or looking up
 * tools and resources fails.
 *
 * @example
 * ```typescript
 * throw RegistryError.toolNotFound('unknown_tool');
 * throw RegistryError.duplicateTool('existing_tool');
 * ```
 */
export class RegistryError extends AppError {
  /** The type of registry item (tool, resource, prompt) */
  readonly itemType: 'tool' | 'resource' | 'prompt';

  /** The name of the item */
  readonly itemName: string;

  constructor(
    message: string,
    itemType: 'tool' | 'resource' | 'prompt',
    itemName: string,
    options: Omit<BaseErrorOptions, 'code'> = {},
  ) {
    super(message, {
      code: ErrorCodes.REGISTRY_ERROR,
      statusCode: 404, // Usually not found
      mcpCode: ErrorCode.MethodNotFound,
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
  // Tool Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a RegistryError for a tool not found.
   */
  static toolNotFound(name: string): RegistryError {
    return new RegistryError(getFrameworkMessage('REGISTRY_TOOL_NOT_FOUND', { name }), 'tool', name, {
      recoveryHint: `Check the tool name '${name}' is correct. Use tools/list to see available tools.`,
    });
  }

  /**
   * Create a RegistryError for duplicate tool registration.
   */
  static duplicateTool(name: string): RegistryError {
    return new RegistryError(getFrameworkMessage('REGISTRY_TOOL_DUPLICATE', { name }), 'tool', name, {
      recoveryHint: `Tool '${name}' is already registered. Use a different name.`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a RegistryError for a resource not found.
   */
  static resourceNotFound(name: string): RegistryError {
    return new RegistryError(getFrameworkMessage('REGISTRY_RESOURCE_NOT_FOUND', { name }), 'resource', name, {
      recoveryHint: `Check the resource URI '${name}' is correct. Use resources/list to see available resources.`,
    });
  }

  /**
   * Create a RegistryError for duplicate resource registration.
   */
  static duplicateResource(name: string): RegistryError {
    return new RegistryError(getFrameworkMessage('REGISTRY_RESOURCE_DUPLICATE', { name }), 'resource', name, {
      recoveryHint: `Resource '${name}' is already registered. Use a different URI.`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Prompt Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a RegistryError for a prompt not found.
   */
  static promptNotFound(name: string): RegistryError {
    return new RegistryError(getFrameworkMessage('REGISTRY_PROMPT_NOT_FOUND', { name }), 'prompt', name, {
      recoveryHint: `Check the prompt name '${name}' is correct. Use prompts/list to see available prompts.`,
    });
  }

  /**
   * Create a RegistryError for duplicate prompt registration.
   */
  static duplicatePrompt(name: string): RegistryError {
    return new RegistryError(getFrameworkMessage('REGISTRY_PROMPT_DUPLICATE', { name }), 'prompt', name, {
      recoveryHint: `Prompt '${name}' is already registered. Use a different name.`,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Generic Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a RegistryError for a generic duplicate registration.
   *
   * @param itemType - The type of item (e.g., 'Tool', 'Resource', 'Prompt')
   * @param itemName - The name of the item
   */
  static duplicate(itemType: string, itemName: string): RegistryError {
    const normalizedType = itemType.toLowerCase() as 'tool' | 'resource' | 'prompt';
    return new RegistryError(`${itemType} '${itemName}' is already registered`, normalizedType, itemName, {
      recoveryHint: `${itemType} '${itemName}' is already registered. Use a different name.`,
    });
  }
}
