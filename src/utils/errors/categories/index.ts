/**
 * Error Categories - Barrel Export
 *
 * Re-exports all categorized error classes.
 *
 * @module errors/categories
 */

// API Errors
export { ApiError, ConnectionError, AuthenticationError, NotFoundError } from './api.js';

// Validation Errors
export { ValidationError, ConfigurationError } from './validation.js';

// Operation Errors
export { OperationError, OperationCancelledError, ClientNotConfiguredError } from './operation.js';

// MCP Errors
export { McpProtocolError, SessionError, TransportError } from './mcp.js';

// System Errors
export { InternalError, RegistryError } from './system.js';
