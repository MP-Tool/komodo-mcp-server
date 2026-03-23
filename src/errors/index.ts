/**
 * Application Errors Module
 *
 * @module errors
 */

// Messages
export { AppMessages, getAppMessage, type AppMessageKey, type MessageParams } from "./messages.js";

// Error classes
export { ApiError, ConnectionError, AuthenticationError, NotFoundError, ClientNotConfiguredError } from "./classes.js";

// Factory
export { AppErrorFactory, type AppErrorFactoryType } from "./factory.js";

// Re-exports from framework
export { AppError, FrameworkErrorFactory, type ErrorCodeType, type BaseErrorOptions } from "mcp-server-framework";
export { ErrorCodes, HttpStatus } from "mcp-server-framework/errors";
