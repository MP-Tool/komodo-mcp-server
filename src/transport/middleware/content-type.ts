import { Request, Response, NextFunction } from 'express';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

/**
 * Validates that POST requests have the correct Content-Type header
 * MCP Specification: POST requests must use application/json
 */
export function validateContentType(req: Request, res: Response, next: NextFunction) {
    // Only applies to POST requests
    if (req.method !== 'POST') {
        return next();
    }

    const contentType = req.headers['content-type'];

    if (!contentType || !contentType.includes('application/json')) {
        res.status(415).json({
            jsonrpc: '2.0',
            id: null,
            error: {
                code: ErrorCode.InvalidRequest,
                message: 'Content-Type must be application/json for POST requests'
            }
        });
        return;
    }

    next();
}
