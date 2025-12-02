/**
 * DNS Rebinding Protection middleware
 * MCP Spec 2025-06-18 MUST requirement
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env.js';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { logSecurityEvent } from '../utils/logging.js';
import { getAllowedHosts, getAllowedOrigins } from '../config/transport.config.js';

/**
 * DNS Rebinding Protection Middleware
 * Validates Host header to prevent DNS rebinding attacks
 * Origin validation only enabled for non-localhost bindings
 */
export function dnsRebindingProtection(req: Request, res: Response, next: NextFunction): void {
    const host = req.headers.host;
    const allowedHosts = getAllowedHosts();

    // Validate Host header (MUST for all configurations)
    if (!host || !allowedHosts.includes(host)) {
        logSecurityEvent(`DNS Rebinding attempt blocked: Host=${host}`);
        res.status(403).json(createJsonRpcError(-32000, 'Forbidden: Invalid Host header'));
        return;
    }

    // Origin validation only for non-localhost bindings
    // Localhost-only servers cannot receive cross-origin requests
    const bindHost = config.MCP_BIND_HOST;
    if (bindHost !== '127.0.0.1' && bindHost !== 'localhost') {
        const origin = req.headers.origin;
        if (origin) {
            const allowedOrigins = getAllowedOrigins();
            if (!allowedOrigins.includes(origin)) {
                logSecurityEvent(`Invalid Origin blocked: ${origin}`);
                res.status(403).json(createJsonRpcError(-32000, 'Forbidden: Invalid Origin header'));
                return;
            }
        }
    }

    next();
}
