/**
 * Transport Utilities
 *
 * Utility functions for the MCP transport layer.
 *
 * - **JSON-RPC** - Error response creation and validation
 * - **Logging** - Security event logging and sanitization
 *
 * @module server/transport/utils
 */

// ===== JSON-RPC Utilities =====
export { createJsonRpcError, JsonRpcErrorCode } from './json-rpc.js';

// ===== Security Logging =====
export { logSecurityEvent, sanitizeForLog } from './logging.js';
