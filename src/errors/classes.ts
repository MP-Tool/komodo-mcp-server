/**
 * Komodo Error Classes
 *
 * Application-specific error classes extending the framework's AppError.
 *
 * @module errors/classes
 */

import { ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { AppError, type BaseErrorOptions } from "mcp-server-framework";
import { ErrorCodes, HttpStatus } from "mcp-server-framework/errors";
import { getAppMessage } from "./messages.js";

// ============================================================================
// API Error
// ============================================================================

export class ApiError extends AppError {
  readonly endpoint?: string | undefined;
  readonly apiStatusCode?: number | undefined;

  constructor(
    message: string,
    options: Omit<BaseErrorOptions, "code"> & {
      endpoint?: string | undefined;
      apiStatusCode?: number | undefined;
    } = {},
  ) {
    super(message, {
      code: ErrorCodes.API_ERROR,
      statusCode: options.statusCode || HttpStatus.INTERNAL_SERVER_ERROR,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: {
        ...options.context,
        endpoint: options.endpoint,
        apiStatusCode: options.apiStatusCode,
      },
    });
    this.endpoint = options.endpoint;
    this.apiStatusCode = options.apiStatusCode;
  }

  static requestFailed(reason?: string): ApiError {
    const message = reason
      ? getAppMessage("API_REQUEST_FAILED_REASON", { reason })
      : getAppMessage("API_REQUEST_FAILED");
    return new ApiError(message, { recoveryHint: "Check the API endpoint and try again." });
  }

  static fromResponse(status: number, responseMessage: string, endpoint?: string): ApiError {
    return new ApiError(
      getAppMessage("API_REQUEST_FAILED_STATUS", { status: String(status), message: responseMessage }),
      {
        apiStatusCode: status,
        endpoint,
        statusCode: HttpStatus.BAD_REQUEST,
        recoveryHint:
          status >= 500 ? "The API server encountered an error. Try again later." : "Check the request parameters.",
      },
    );
  }

  static invalidResponse(reason?: string): ApiError {
    const message = reason
      ? `${getAppMessage("API_RESPONSE_INVALID")}: ${reason}`
      : getAppMessage("API_RESPONSE_INVALID");
    return new ApiError(message, { recoveryHint: "The API returned an unexpected response format." });
  }

  static parseError(cause?: Error): ApiError {
    return new ApiError(getAppMessage("API_RESPONSE_PARSE_ERROR"), {
      cause,
      recoveryHint: "The API response could not be parsed. Check the API version compatibility.",
    });
  }
}

// ============================================================================
// Connection Error
// ============================================================================

export class ConnectionError extends AppError {
  readonly target: string;

  constructor(message: string, target: string, options: Omit<BaseErrorOptions, "code"> = {}) {
    super(message, {
      code: ErrorCodes.CONNECTION_ERROR,
      statusCode: HttpStatus.BAD_GATEWAY,
      mcpCode: ErrorCode.InternalError,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: { ...options.context, target },
    });
    this.target = target;
  }

  static failed(target: string, reason?: string): ConnectionError {
    const message = reason
      ? `${getAppMessage("CONNECTION_FAILED", { target })}: ${reason}`
      : getAppMessage("CONNECTION_FAILED", { target });
    return new ConnectionError(message, target, {
      recoveryHint: `Check that the Komodo server at '${target}' is running and accessible.`,
    });
  }

  static refused(target: string): ConnectionError {
    return new ConnectionError(getAppMessage("CONNECTION_REFUSED", { target }), target, {
      recoveryHint: `Ensure the Komodo server is running at '${target}' and accepting connections.`,
    });
  }

  static timeout(target: string, timeoutMs?: number): ConnectionError {
    const message = timeoutMs
      ? `${getAppMessage("CONNECTION_TIMEOUT", { target })} (after ${timeoutMs}ms)`
      : getAppMessage("CONNECTION_TIMEOUT", { target });
    return new ConnectionError(message, target, {
      statusCode: HttpStatus.GATEWAY_TIMEOUT,
      recoveryHint: `Connection to '${target}' timed out. Check network connectivity.`,
      context: timeoutMs ? { timeoutMs } : undefined,
    });
  }

  static healthCheckFailed(reason: string, cause?: Error): ConnectionError {
    return new ConnectionError(getAppMessage("CONNECTION_HEALTH_CHECK_FAILED", { reason }), "health-check", {
      cause,
      recoveryHint: "Health check failed. Ensure the Komodo server is fully operational.",
    });
  }
}

// ============================================================================
// Authentication Error
// ============================================================================

export class AuthenticationError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, "code"> = {}) {
    super(message, {
      code: ErrorCodes.API_AUTHENTICATION_ERROR,
      statusCode: options.statusCode || HttpStatus.UNAUTHORIZED,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: options.context,
    });
  }

  static failed(reason?: string): AuthenticationError {
    const message = reason ? getAppMessage("AUTH_FAILED_REASON", { reason }) : getAppMessage("AUTH_FAILED");
    return new AuthenticationError(message, { recoveryHint: "Check your credentials and try again." });
  }

  static invalidCredentials(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_INVALID_CREDENTIALS"), {
      recoveryHint: "Verify the username and password are correct.",
    });
  }

  static tokenExpired(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_TOKEN_EXPIRED"), {
      recoveryHint: "Reconfigure the client to obtain a new token.",
    });
  }

  static tokenInvalid(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_TOKEN_INVALID"), {
      recoveryHint: "Reconfigure the client with valid credentials.",
    });
  }

  static unauthorized(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_UNAUTHORIZED"), {
      recoveryHint: "Ensure you have the required permissions.",
    });
  }

  static forbidden(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_FORBIDDEN"), {
      statusCode: HttpStatus.FORBIDDEN,
      recoveryHint: "You do not have permission to perform this action.",
    });
  }

  static loginFailed(status: number, statusText: string): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_LOGIN_FAILED", { status: String(status), statusText }), {
      recoveryHint: "Login failed. Check your credentials and ensure the Komodo server is accessible.",
    });
  }

  static noToken(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_NO_TOKEN"), {
      recoveryHint: "Server did not return an authentication token. This may be a server configuration issue.",
    });
  }

  static tokenMissing(): AuthenticationError {
    return new AuthenticationError(getAppMessage("AUTH_TOKEN_MISSING"), {
      recoveryHint: "Authentication token is missing. Use komodo_configure to authenticate first.",
    });
  }
}

// ============================================================================
// Not Found Error
// ============================================================================

export class NotFoundError extends AppError {
  readonly resourceType: string;
  readonly resourceId: string;

  constructor(message: string, resourceType: string, resourceId: string, options: Omit<BaseErrorOptions, "code"> = {}) {
    super(message, {
      code: ErrorCodes.NOT_FOUND,
      statusCode: HttpStatus.NOT_FOUND,
      mcpCode: ErrorCode.InvalidParams,
      cause: options.cause,
      recoveryHint: options.recoveryHint,
      context: { ...options.context, resourceType, resourceId },
    });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }

  static resource(resource: string, type = "Resource"): NotFoundError {
    return new NotFoundError(
      getAppMessage("RESOURCE_NOT_FOUND_TYPE", { resourceType: type, resourceId: resource }),
      type,
      resource,
      { recoveryHint: `Check if the ${type.toLowerCase()} '${resource}' exists.` },
    );
  }

  static server(server: string): NotFoundError {
    return new NotFoundError(getAppMessage("SERVER_NOT_FOUND", { server }), "Server", server, {
      recoveryHint: `Check if the server '${server}' exists. Use list_servers to see available servers.`,
    });
  }

  static container(container: string): NotFoundError {
    return new NotFoundError(getAppMessage("CONTAINER_NOT_FOUND", { container }), "Container", container, {
      recoveryHint: `Check if the container '${container}' exists. Use list_containers to see available containers.`,
    });
  }

  static stack(stack: string): NotFoundError {
    return new NotFoundError(getAppMessage("STACK_NOT_FOUND", { stack }), "Stack", stack, {
      recoveryHint: `Check if the stack '${stack}' exists. Use list_stacks to see available stacks.`,
    });
  }

  static deployment(deployment: string): NotFoundError {
    return new NotFoundError(getAppMessage("DEPLOYMENT_NOT_FOUND", { deployment }), "Deployment", deployment, {
      recoveryHint: `Check if the deployment '${deployment}' exists. Use list_deployments to see available deployments.`,
    });
  }
}

// ============================================================================
// Client Not Configured Error
// ============================================================================

export class ClientNotConfiguredError extends AppError {
  constructor(message: string, options: Omit<BaseErrorOptions, "code"> = {}) {
    super(message, {
      code: ErrorCodes.API_CLIENT_NOT_CONFIGURED,
      statusCode: HttpStatus.PRECONDITION_REQUIRED,
      mcpCode: ErrorCode.InvalidRequest,
      cause: options.cause,
      recoveryHint: options.recoveryHint || "Use the komodo_configure tool to set up the Komodo client.",
      context: options.context,
    });
  }

  static notConfigured(): ClientNotConfiguredError {
    return new ClientNotConfiguredError(getAppMessage("CLIENT_NOT_CONFIGURED"), {
      recoveryHint: "Use the komodo_configure tool to set up the connection with URL, username, and password.",
    });
  }

  static notConnected(): ClientNotConfiguredError {
    return new ClientNotConfiguredError(getAppMessage("CLIENT_NOT_CONNECTED"), {
      recoveryHint: "Check the Komodo server URL and network connectivity, then reconfigure.",
    });
  }

  static invalidConfiguration(reason: string): ClientNotConfiguredError {
    return new ClientNotConfiguredError(getAppMessage("CLIENT_CONFIGURATION_INVALID", { reason }), {
      recoveryHint: `Fix the configuration issue: ${reason}`,
    });
  }
}
