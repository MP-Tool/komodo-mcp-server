/**
 * JSON-RPC utility functions
 */

import { RequestId } from '@modelcontextprotocol/sdk/types.js';

/**
 * Creates a JSON-RPC 2.0 error response
 */
export function createJsonRpcError(code: number, message: string, id: RequestId | null = null) {
  return {
    jsonrpc: '2.0',
    error: { code, message },
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
