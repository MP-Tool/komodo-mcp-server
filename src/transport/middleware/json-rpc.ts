import { Request, Response, NextFunction } from 'express';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Validates that the request body is a valid JSON-RPC 2.0 message
 */
export function validateJsonRpc(req: Request, res: Response, next: NextFunction) {
    // Only applies to POST requests
    if (req.method !== 'POST') {
        return next();
    }

    const body = req.body;

    // Check if body exists and is an object (express.json() should have parsed it)
    if (!body || typeof body !== 'object') {
        res.status(400).json({
            jsonrpc: '2.0',
            id: null,
            error: {
                code: ErrorCode.ParseError,
                message: 'Invalid JSON payload'
            }
        });
        return;
    }

    // Check for JSON-RPC 2.0 compliance
    if (Array.isArray(body)) {
        if (body.length === 0) {
            res.status(400).json({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: ErrorCode.InvalidRequest,
                    message: 'Empty batch request'
                }
            });
            return;
        }
        
        // Validate each message in the batch
        for (const message of body) {
            if (!message || typeof message !== 'object' || message.jsonrpc !== '2.0') {
                res.status(400).json({
                    jsonrpc: '2.0',
                    id: message?.id || null,
                    error: {
                        code: ErrorCode.InvalidRequest,
                        message: 'Invalid JSON-RPC version in batch. Must be "2.0"'
                    }
                });
                return;
            }
        }
    } else {
        // Single message validation
        // Must have jsonrpc: "2.0"
        if (body.jsonrpc !== '2.0') {
            console.error('[Middleware] Invalid JSON-RPC version:', JSON.stringify(body));
            res.status(400).json({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: ErrorCode.InvalidRequest,
                    message: 'Invalid JSON-RPC version. Must be "2.0"'
                }
            });
            return;
        }

        // Must have method (for requests) or result/error (for responses, but client sends requests)
        // Actually, client sends requests or notifications.
        if (!body.method) {
            res.status(400).json({
                jsonrpc: '2.0',
                id: body.id || null,
                error: {
                    code: ErrorCode.InvalidRequest,
                    message: 'Invalid JSON-RPC message: missing method'
                }
            });
            return;
        }
    }

    next();
}
