/**
 * Transport Layer
 *
 * This module provides the HTTP transport layer for the MCP server,
 * implementing the MCP Streamable HTTP Transport specification (2025-03-26)
 * with optional backwards compatibility for Legacy SSE Transport (2024-11-05).
 *
 * ## Supported Transports
 *
 * ### Streamable HTTP Transport (Default, Recommended)
 * - POST /mcp - JSON-RPC messages (creates session on InitializeRequest)
 * - GET /mcp - SSE stream for server-to-client notifications
 * - DELETE /mcp - Session termination
 *
 * ### Legacy SSE Transport (Optional, Deprecated)
 * Enable with `MCP_LEGACY_SSE_ENABLED=true`
 * - GET /sse - Opens SSE stream
 * - POST /sse/message?sessionId=xxx - JSON-RPC messages
 * - GET /mcp (no session) + Accept: text/event-stream - Fallback
 *
 * ## Security Features (MCP Specification)
 * - DNS Rebinding Protection (MUST)
 * - Accept Header Validation (MUST)
 * - Content-Type Validation (MUST)
 * - JSON-RPC Structure Validation (MUST)
 * - Rate Limiting
 * - Session Expiration
 *
 * @see https://modelcontextprotocol.io/specification/2025-03-26/basic/transports
 */

// Main entry point - starts the HTTP server with all configured transports
export { startHttpServer } from './http-server.js';
