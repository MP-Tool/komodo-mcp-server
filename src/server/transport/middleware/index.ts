/**
 * Transport Middleware
 *
 * Collection of Express middleware for MCP transport security and validation.
 * These middleware implement requirements from the MCP specification.
 *
 * ## MCP Specification Requirements (MUST)
 *
 * The following middleware are **required** by the MCP specification:
 *
 * - **DNS Rebinding Protection** - Validates Host header
 * - **Accept Header Validation** - Ensures client accepts required content types
 * - **Content-Type Validation** - Ensures correct Content-Type for POST
 * - **JSON-RPC Validation** - Validates JSON-RPC message structure
 *
 * ## Additional Security Middleware
 *
 * - **Protocol Version** - Validates MCP protocol version
 * - **Rate Limiting** - Prevents abuse and DoS attacks
 *
 * ## Middleware Stack Order
 *
 * The middleware should be applied in this order:
 *
 * ```typescript
 * app.use('/mcp', dnsRebindingProtection);  // 1. Security first
 * app.use('/mcp', createRateLimiter());     // 2. Rate limiting
 * app.use('/mcp', validateProtocolVersion); // 3. Protocol validation
 * app.use('/mcp', validateAcceptHeader);    // 4. Accept header
 * app.use('/mcp', validateContentType);     // 5. Content-Type
 * app.use('/mcp', validateJsonRpc);         // 6. JSON-RPC validation
 * ```
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

// ===== Required by MCP Specification (MUST) =====

/**
 * DNS Rebinding Protection (MCP MUST)
 * Validates Host header to prevent DNS rebinding attacks
 */
export { dnsRebindingProtection } from './dns-rebinding.js';

/**
 * Accept Header Validation (MCP MUST)
 * Validates that client accepts application/json or text/event-stream
 */
export { validateAcceptHeader } from './accept-header.js';

/**
 * Content-Type Validation (MCP MUST)
 * Validates Content-Type header for POST requests
 */
export { validateContentType } from './content-type.js';

/**
 * JSON-RPC Validation (MCP MUST)
 * Validates JSON-RPC message structure and version
 */
export { validateJsonRpc } from './json-rpc.js';

// ===== Additional Security =====

/**
 * Protocol Version Validation
 * Validates MCP protocol version header
 */
export { validateProtocolVersion } from './protocol-version.js';

/**
 * Rate Limiting
 * Prevents abuse and DoS attacks
 */
export { createRateLimiter, type RateLimiterOptions } from './rate-limit.js';
