/**
 * Application Errors Module
 *
 * @module errors
 */

// Messages
export { AppMessages, getAppMessage, type AppMessageKey, type MessageParams } from "./messages.js";

// Error classes
export {
  ApiError,
  ConnectionError,
  AuthenticationError,
  NotFoundError,
  ClientNotConfiguredError,
  ConfirmationRequiredError,
} from "./classes.js";

// Error extraction
export { formatError, extractKomodoError, isAuthRejection } from "./extraction.js";

// Re-exports from framework
export { AppError, ValidationError, type ErrorCodeType, type BaseErrorOptions } from "mcp-server-framework";
export { ErrorCodes, HttpStatus } from "mcp-server-framework/errors";
