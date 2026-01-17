/**
 * DNS Rebinding Protection middleware
 * MCP Spec 2025-06-18 MUST requirement
 *
 * SECURITY NOTE: This middleware validates Host and Origin headers to prevent
 * DNS rebinding attacks. For production deployments:
 * - Always run behind a reverse proxy (nginx, traefik) with proper TLS
 * - Configure explicit MCP_ALLOWED_HOSTS and MCP_ALLOWED_ORIGINS
 */

import { Request, Response, NextFunction } from 'express';
import { config, getAllowedHosts, getAllowedOrigins, isLocalHost } from '../../../app/config/index.js';
import { createJsonRpcError, logSecurityEvent, sanitizeForLog } from '../utils/index.js';
import { HTTP_STATUS, TRANSPORT_ERROR_CODES, TransportErrorMessages } from '../core/index.js';

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
    res
      .status(HTTP_STATUS.FORBIDDEN)
      .json(createJsonRpcError(TRANSPORT_ERROR_CODES.DNS_REBINDING, TransportErrorMessages.DNS_REBINDING_BLOCKED));
    return;
  }

  // Origin validation only for non-localhost bindings
  // Localhost-only servers cannot receive cross-origin requests
  const bindHost = config.MCP_BIND_HOST;
  if (bindHost !== '127.0.0.1' && bindHost !== 'localhost') {
    const origin = req.headers.origin;
    if (origin) {
      const allowedOrigins = getAllowedOrigins();
      // Check if origin is in the allowed list
      // Note: Wildcard '*' is filtered out in production mode by getAllowedOrigins()
      if (!allowedOrigins.includes('*') && !allowedOrigins.includes(origin)) {
        logSecurityEvent(`Invalid Origin blocked: ${origin}`);
        res
          .status(HTTP_STATUS.FORBIDDEN)
          .json(createJsonRpcError(TRANSPORT_ERROR_CODES.INVALID_ORIGIN, TransportErrorMessages.ORIGIN_NOT_ALLOWED));
        return;
      }
    }
  }

  next();
}
