/**
 * Resource Error Classes
 *
 * Errors related to resources and client configuration:
 * - NotFoundError: Resource not found
 * - ClientNotConfiguredError: Client not configured
 *
 * @module app/errors/resource
 */

import { ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { AppError, ErrorCodes, type BaseErrorOptions, HttpStatus } from '../framework.js';
import { getAppMessage } from './messages.js';

// ============================================================================
// Not Found Error
// ============================================================================

/**
 * Error thrown when a resource is not found.
 *
 * @example
 * ```typescript
 * throw NotFoundError.resource('my-resource');
 * throw NotFoundError.server('prod-server');
 * throw NotFoundError.container('nginx-1');
 * ```
 */
export class NotFoundError extends AppError {
  /** The type of resource */
  readonly resourceType: string;

  /** The identifier of the resource */
  readonly resourceId: string;

  constructor(message: string, resourceType: string, resourceId: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      mcpCode: ErrorCode.InvalidParams,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        resourceType,
        resourceId,
      },
    });

    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a NotFoundError for a generic resource.
   */
  static resource(resource: string, type = 'Resource'): NotFoundError {
    return new NotFoundError(
      getAppMessage('RESOURCE_NOT_FOUND_TYPE', { resourceType: type, resourceId: resource }),
      type,
      resource,
      {
        recoveryHint: `Check if the ${type.toLowerCase()} '${resource}' exists.`,
      },
    );
  }

  /**
   * Create a NotFoundError for a server.
   */
  static server(server: string): NotFoundError {
    return new NotFoundError(getAppMessage('SERVER_NOT_FOUND', { server }), 'Server', server, {
      recoveryHint: `Check if the server '${server}' exists. Use list_servers to see available servers.`,
    });
  }

  /**
   * Create a NotFoundError for a container.
   */
  static container(container: string): NotFoundError {
    return new NotFoundError(getAppMessage('CONTAINER_NOT_FOUND', { container }), 'Container', container, {
      recoveryHint: `Check if the container '${container}' exists. Use list_containers to see available containers.`,
    });
  }

  /**
   * Create a NotFoundError for a stack.
   */
  static stack(stack: string): NotFoundError {
    return new NotFoundError(getAppMessage('STACK_NOT_FOUND', { stack }), 'Stack', stack, {
      recoveryHint: `Check if the stack '${stack}' exists. Use list_stacks to see available stacks.`,
    });
  }

  /**
   * Create a NotFoundError for a deployment.
   */
  static deployment(deployment: string): NotFoundError {
    return new NotFoundError(getAppMessage('DEPLOYMENT_NOT_FOUND', { deployment }), 'Deployment', deployment, {
      recoveryHint: `Check if the deployment '${deployment}' exists. Use list_deployments to see available deployments.`,
    });
  }
}

// ============================================================================
// Client Not Configured Error
// ============================================================================

/**
 * Error thrown when the Komodo client is not configured.
 *
 * @example
 * ```typescript
 * throw ClientNotConfiguredError.notConfigured();
 * throw ClientNotConfiguredError.notConnected();
 * ```
 */
export class ClientNotConfiguredError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, 'code'> = {}) {
    super(message, {
      code: ErrorCodes.API_CLIENT_NOT_CONFIGURED,
      statusCode: HttpStatus.PRECONDITION_REQUIRED,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint: options.recoveryHint || 'Use the komodo_configure tool to set up the Komodo client.',
      context: options.context,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Factory Methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Create a ClientNotConfiguredError for unconfigured client.
   */
  static notConfigured(): ClientNotConfiguredError {
    return new ClientNotConfiguredError(getAppMessage('CLIENT_NOT_CONFIGURED'), {
      recoveryHint: 'Use the komodo_configure tool to set up the connection with URL, username, and password.',
    });
  }

  /**
   * Create a ClientNotConfiguredError for disconnected client.
   */
  static notConnected(): ClientNotConfiguredError {
    return new ClientNotConfiguredError(getAppMessage('CLIENT_NOT_CONNECTED'), {
      recoveryHint: 'Check the Komodo server URL and network connectivity, then reconfigure.',
    });
  }

  /**
   * Create a ClientNotConfiguredError for invalid configuration.
   */
  static invalidConfiguration(reason: string): ClientNotConfiguredError {
    return new ClientNotConfiguredError(getAppMessage('CLIENT_CONFIGURATION_INVALID', { reason }), {
      recoveryHint: `Fix the configuration issue: ${reason}`,
    });
  }
}
