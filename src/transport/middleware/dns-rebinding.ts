/**
 * DNS Rebinding Protection middleware
 * MCP Spec 2025-06-18 MUST requirement
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env.js';
import { createJsonRpcError } from '../utils/json-rpc.js';
import { logSecurityEvent, sanitizeForLog } from '../utils/logging.js';
import { getAllowedHosts, getAllowedOrigins, isLocalHost } from '../config/transport.config.js';

/**
 * DNS Rebinding Protection Middleware
 * Validates Host header to prevent DNS rebinding attacks
 * Origin validation only enabled for non-localhost bindings
 */
export function dnsRebindingProtection(req: Request, res: Response, next: NextFunction): void {
  const host = req.headers.host;
  const allowedHosts = getAllowedHosts();

  // Validate Host header (MUST for all configurations)
  // We allow localhost/127.0.0.1 on ANY port to support Docker port mapping ONLY if no custom hosts are defined
  const cleanHost = host ? host.trim() : '';

  // If MCP_ALLOWED_HOSTS is set, we strictly enforce that list (no implicit localhost bypass).
  // If not set, we allow defaults AND any localhost port (to support Docker port mapping).
  const strictMode = !!config.MCP_ALLOWED_HOSTS;
  const isAllowed = strictMode
    ? allowedHosts.includes(cleanHost)
    : isLocalHost(cleanHost) || allowedHosts.includes(cleanHost);

  if (!host || !isAllowed) {
    logSecurityEvent(`DNS Rebinding attempt blocked: Host=${sanitizeForLog(host)}`);
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
      // Allow if wildcard '*' is present OR if specific origin matches
      if (!allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
        logSecurityEvent(`Invalid Origin blocked: ${origin}`);
        res.status(403).json(createJsonRpcError(-32000, 'Forbidden: Invalid Origin header'));
        return;
      }
    }
  }

  next();
}
