/**
 * Handler Core Module
 *
 * Exports the fundamental types and constants for the handler system.
 *
 * @module server/handlers/core
 */

// ============================================================================
// Types
// ============================================================================

export type {
  HandlerType,
  HandlerRegistrationResult,
  HandlerMetadata,
  HandlerSetupFn,
  HandlerDefinition,
  HandlerRegistry,
  PingResult,
  CancellationParams,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

export {
  HANDLER_NAMES,
  type HandlerName,
  HANDLER_LOG_COMPONENTS,
  MCP_SPEC_URLS,
  MCP_SPEC_VERSION,
  HandlerLogMessages,
} from './constants.js';
