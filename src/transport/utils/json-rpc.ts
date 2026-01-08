/**
 * JSON-RPC utility functions
 */

import { RequestId } from '@modelcontextprotocol/sdk/types.js';
import { JsonRpcErrorCode, type JsonRpcErrorCodeValue } from '../../config/index.js';

// Re-export error codes for convenience
export { JsonRpcErrorCode };

/**
 * Creates a JSON-RPC 2.0 error response
 *
 * @param code - JSON-RPC error code (use JsonRpcErrorCode enum)
 * @param message - Error message (required)
 * @param id - Request ID (null for notifications)
 */
export function createJsonRpcError(
  code: JsonRpcErrorCodeValue | number,
  message?: string,
  id: RequestId | null = null,
) {
  return {
    jsonrpc: '2.0',
    error: { code, message: message ?? 'Unknown error' },
    id,
  };
}

/**
 * Creates a JSON-RPC 2.0 success response
 */
export function createJsonRpcResult(result: unknown, id: RequestId | null = null) {
  return {
    jsonrpc: '2.0',
    result,
    id,
  };
}
