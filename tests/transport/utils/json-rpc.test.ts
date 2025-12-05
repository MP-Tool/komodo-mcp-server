import { describe, it, expect } from 'vitest';
import { createJsonRpcError, createJsonRpcResult } from '../../../src/transport/utils/json-rpc.js';

describe('JSON-RPC Utils', () => {
  describe('createJsonRpcError', () => {
    it('should create error response', () => {
      const error = createJsonRpcError(-32600, 'Invalid Request', 1);
      expect(error).toEqual({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id: 1
      });
    });

    it('should create error response with null id', () => {
      const error = createJsonRpcError(-32600, 'Invalid Request');
      expect(error).toEqual({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
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
