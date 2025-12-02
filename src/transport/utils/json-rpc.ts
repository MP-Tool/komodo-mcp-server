/**
 * JSON-RPC utility functions
 */

/**
 * Creates a JSON-RPC 2.0 error response
 */
export function createJsonRpcError(code: number, message: string) {
    return {
        jsonrpc: '2.0',
        error: { code, message },
        id: null
    };
}

/**
 * Creates a JSON-RPC 2.0 success response
 */
export function createJsonRpcResult(result: any, id: any = null) {
    return {
        jsonrpc: '2.0',
        result,
        id
    };
}
