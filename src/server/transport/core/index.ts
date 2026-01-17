/**
 * Transport Core Module
 *
 * Centralized types and constants for the transport layer.
 * This module provides the foundation for all transport implementations.
 *
 * @module server/transport/core
 */

// ============================================================================
// Base Error Classes
// ============================================================================

export {
  TransportErrorCodes,
  TransportError,
  getMcpCodeForTransportError,
  getHttpStatusForTransportError,
  type TransportErrorCode,
  type TransportErrorOptions,
} from './base.js';

// ============================================================================
// Types
// ============================================================================

export type {
  McpServerFactory,
  TransportType,
  TransportState,
  TransportConfig,
  SessionRequest,
  SessionResponse,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

export {
  JSON_RPC_ERROR_CODES,
  TRANSPORT_ERROR_CODES,
  TRANSPORT_LOG_COMPONENTS,
  TransportErrorMessages,
  formatProtocolVersionError,
} from './constants.js';

// ============================================================================
// Re-exports from Framework Errors (for convenience)
// ============================================================================

/**
 * HTTP Status codes re-exported from framework errors.
 * Use `HttpStatus` from `server/errors` for the canonical source.
 */
export { HttpStatus as HTTP_STATUS } from '../../errors/index.js';
