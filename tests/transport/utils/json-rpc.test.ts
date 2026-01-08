import { describe, it, expect } from 'vitest';
import { createJsonRpcError, createJsonRpcResult, JsonRpcErrorCode } from '../../../src/transport/utils/json-rpc.js';

describe('JSON-RPC Utils', () => {
  describe('createJsonRpcError', () => {
    it('should create error response', () => {
      const error = createJsonRpcError(JsonRpcErrorCode.INVALID_REQUEST, 'Invalid Request', 1);
      expect(error).toEqual({
        jsonrpc: '2.0',
        error: { code: JsonRpcErrorCode.INVALID_REQUEST, message: 'Invalid Request' },
        id: 1
      });
    });

    it('should create error response with null id', () => {
      const error = createJsonRpcError(JsonRpcErrorCode.INVALID_REQUEST, 'Invalid Request');
      expect(error).toEqual({
        jsonrpc: '2.0',
        error: { code: JsonRpcErrorCode.INVALID_REQUEST, message: 'Invalid Request' },
        id: null
      });
    });
  });

  describe('createJsonRpcResult', () => {
    it('should create success response', () => {
      const result = createJsonRpcResult({ foo: 'bar' }, 1);
      expect(result).toEqual({
        jsonrpc: '2.0',
        result: { foo: 'bar' },
        id: 1
      });
    });

    it('should create success response with null id', () => {
      const result = createJsonRpcResult({ foo: 'bar' });
      expect(result).toEqual({
        jsonrpc: '2.0',
        result: { foo: 'bar' },
        id: null
      });
    });
  });
});
