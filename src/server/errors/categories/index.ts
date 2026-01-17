/**
 * Error Categories Barrel Export
 *
 * @module server/errors/categories
 */

// MCP Protocol Errors
export { McpProtocolError, SessionError, TransportError } from './mcp.js';

// Validation Errors
export { ValidationError, ConfigurationError } from './validation.js';

// System Errors
export { InternalError, RegistryError } from './system.js';

// Operation Errors
export { OperationError, OperationCancelledError } from './operation.js';

// Connection Errors
export { FrameworkConnectionError } from './connection.js';
