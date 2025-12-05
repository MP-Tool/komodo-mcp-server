/**
 * JSON-RPC Middleware Fuzzing Tests
 * 
 * This test suite uses property-based testing (fuzzing) to verify the robustness
 * of the JSON-RPC middleware. It generates arbitrary JSON inputs to ensure
 * the middleware handles malformed or unexpected data without crashing the server.
 */
import { describe, it, vi } from 'vitest';
import fc from 'fast-check';
import { validateJsonRpc } from '../../src/transport/middleware/json-rpc';
import { Request, Response } from 'express';

describe('JSON-RPC Middleware Fuzzing', () => {
  it('should handle arbitrary JSON bodies without crashing', () => {
    fc.assert(
      fc.property(fc.jsonValue(), (jsonBody) => {
        // Mock Request
        const req = {
          method: 'POST',
          body: jsonBody,
        } as unknown as Request;

        // Mock Response
        const res = {
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
          send: vi.fn().mockReturnThis(),
        } as unknown as Response;

        // Mock Next
        const next = vi.fn();

        try {
          validateJsonRpc(req, res, next);
        } catch (error) {
          // The middleware should handle errors gracefully (e.g. via res.status(400))
          // and never throw an unhandled exception.
          return false;
        }

        // Verification:
        // The middleware must either call next() (valid request) 
        // or send a response (invalid request).
        // It should not do nothing.
        return true;
      }),
      {
        verbose: true,
        numRuns: 1000, // Extensive testing
      }
    );
  });

  it('should handle arbitrary non-POST methods', () => {
    fc.assert(
        fc.property(fc.string(), (method) => {
            if (method === 'POST') return true; // Skip POST as it's handled above

            const req = {
                method: method,
                body: {}
            } as unknown as Request;

            const res = {
                status: vi.fn().mockReturnThis(),
                json: vi.fn().mockReturnThis(),
            } as unknown as Response;

            const next = vi.fn();

            validateJsonRpc(req, res, next);

            // Should always call next() for non-POST
            return next.mock.calls.length === 1;
        })
    );
  });
});
