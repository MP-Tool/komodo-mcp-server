/**
 * Handler Core Constants Module
 *
 * Centralized constants for the handler system.
 * All handler-related constants should be defined here for consistency.
 *
 * @module server/handlers/core/constants
 */

// ============================================================================
// Handler Names
// ============================================================================

/**
 * Standard MCP protocol handler names.
 */
export const HANDLER_NAMES = {
  /** Ping/pong liveness check handler */
  PING: 'ping',
  /** Request cancellation handler */
  CANCELLATION: 'cancellation',
} as const;

export type HandlerName = (typeof HANDLER_NAMES)[keyof typeof HANDLER_NAMES];

// ============================================================================
// Log Components
// ============================================================================

/**
 * Logger component names for handlers.
 */
export const HANDLER_LOG_COMPONENTS = {
  /** Ping handler log component */
  PING: 'ping',
  /** Cancellation handler log component */
  CANCELLATION: 'cancellation',
  /** Handler registry log component */
  REGISTRY: 'handler-registry',
} as const;

// ============================================================================
// MCP Specification References
// ============================================================================

/**
 * MCP specification URLs for handler documentation.
 */
export const MCP_SPEC_URLS = {
  /** Cancellation specification */
  CANCELLATION: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation',
  /** Progress specification */
  PROGRESS: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/progress',
  /** Ping specification (part of base protocol) */
  PING: 'https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/ping',
} as const;

/**
 * Current MCP specification version supported.
 */
export const MCP_SPEC_VERSION = '2025-11-25';

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Standardized log messages for handlers.
 */
export const HandlerLogMessages = {
  // Registration messages
  HANDLER_REGISTERED: '%s handler registered',
  HANDLER_REGISTRATION_FAILED: 'Failed to register %s handler: %s',
  ALL_HANDLERS_REGISTERED: 'All handlers registered (%d total)',

  // Ping messages
  PING_RECEIVED: 'Received ping, sent pong',
  PONG_SENT: '🏓 pong',

  // Cancellation messages
  CANCELLATION_RECEIVED: 'Cancellation received: requestId=%s reason=%s',
  CANCELLATION_IGNORED_NO_ID: 'Cancellation ignored: no requestId provided',
  CANCELLATION_IGNORED_NOT_FOUND: 'Cancellation ignored: request not found or already completed',
} as const;
