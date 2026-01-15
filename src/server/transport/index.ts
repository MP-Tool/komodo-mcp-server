/**
 * Transport Layer
 *
 * This module provides the HTTP transport layer for the MCP server,
 * implementing the MCP Streamable HTTP Transport specification (2025-03-26)
 * with optional backwards compatibility for SSE Transport (2024-11-05).
 *
 * ## Supported Transports
 *
 * ### Streamable HTTP Transport (Default, Recommended)
 * - POST /mcp - JSON-RPC messages (creates session on InitializeRequest)
 * - GET /mcp - SSE stream for server-to-client notifications
 * - DELETE /mcp - Session termination
 *
 * ### SSE Transport (Optional, Deprecated but Supported)
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

// ============================================================================
// Core Types, Constants, and Errors
// ============================================================================

// Core types (generic transport interfaces)
export type {
  McpServerFactory,
  TransportType,
  TransportState,
  TransportConfig,
  SessionRequest,
  SessionResponse,
  // Error types
  TransportErrorCode,
  TransportErrorOptions,
} from './core/index.js';

// Core error classes
export {
  TransportErrorCodes,
  TransportError,
  getMcpCodeForTransportError,
  getHttpStatusForTransportError,
} from './core/index.js';

// Core constants
export {
  JSON_RPC_ERROR_CODES,
  TRANSPORT_ERROR_CODES,
  TRANSPORT_LOG_COMPONENTS,
  TransportErrorMessages,
  formatProtocolVersionError,
} from './core/index.js';

// ============================================================================
// HTTP Server
// ============================================================================

// Main entry point - starts the HTTP server with all configured transports
export { startHttpServer, type HttpServerOptions } from './http-server.js';

// ============================================================================
// Streamable HTTP Transport (MCP 2025-03-26)
// ============================================================================

export { createStreamableHttpRouter } from './streamable-http/index.js';

// Streamable HTTP lifecycle types
export type {
  HttpTransportState,
  HttpTransportStateListener,
  HttpTransportStateEvent,
  HttpSessionInitResult,
  HttpSessionTerminationReason,
  HttpSessionTerminationEvent,
  HttpRequestLifecycle,
  HttpTransportMetrics,
  HttpSessionHealth,
} from './streamable-http/index.js';

// Streamable HTTP lifecycle constants
export {
  HTTP_TRANSPORT_STATES,
  HTTP_TRANSPORT_CONFIG,
  MCP_HTTP_HEADERS,
  HTTP_HEADERS,
  HTTP_LIFECYCLE_LOG_COMPONENTS,
  HttpLifecycleLogMessages,
  HTTP_TELEMETRY_ATTRIBUTES,
  HTTP_TRANSPORT_ERRORS,
} from './streamable-http/index.js';

// ============================================================================
// SSE Transport (MCP 2024-11-05 - Deprecated but Supported)
// ============================================================================

export {
  SseTransport,
  LegacySseTransport,
  createSseRouter,
  createLegacySseRouter,
  handleSseConnection,
  handleLegacySseConnection,
  getSseSessionCount,
  getLegacySseSessionCount,
  closeAllSseSessions,
  closeAllLegacySseSessions,
  isSseEnabled,
  isLegacySseEnabled,
} from './sse/index.js';

// SSE lifecycle types
export type {
  SseTransportState,
  SseTransportStateListener,
  SseTransportStateEvent,
  SseConnectionMetrics,
  SseConnectionHealth,
  SseReconnectionConfig,
  SseReconnectionState,
} from './sse/index.js';

// SSE lifecycle constants
export {
  SSE_TRANSPORT_STATES,
  SSE_TRANSPORT_CONFIG,
  SSE_RECONNECTION_DEFAULTS,
  SSE_LIFECYCLE_LOG_COMPONENTS,
  SSE_EVENT_NAMES,
  SseLifecycleLogMessages,
  SSE_TELEMETRY_ATTRIBUTES,
} from './sse/index.js';

// ============================================================================
// Utilities
// ============================================================================

export { createJsonRpcError, JsonRpcErrorCode } from './utils/index.js';
