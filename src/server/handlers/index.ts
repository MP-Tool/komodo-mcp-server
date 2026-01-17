/**
 * MCP Protocol Handlers Module
 *
 * Central export point for MCP protocol notification and request handlers.
 * Provides both setup functions for direct usage and HandlerDefinitions
 * for programmatic registration.
 *
 * ## Exported Handlers
 *
 * - **Ping Handler**: Responds to client liveness checks
 * - **Cancellation Handler**: Processes request cancellation notifications
 *
 * ## Usage Patterns
 *
 * ### Direct Setup (Traditional)
 * ```typescript
 * import { setupPingHandler, setupCancellationHandler } from './handlers/index.js';
 *
 * setupPingHandler(server);
 * setupCancellationHandler(server);
 * ```
 *
 * ### Handler Definitions (Programmatic)
 * ```typescript
 * import { pingHandler, cancellationHandler } from './handlers/index.js';
 *
 * const handlers = [pingHandler, cancellationHandler];
 * handlers.forEach(h => h.setup(server));
 * ```
 *
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/ping
 * @see https://modelcontextprotocol.io/specification/2025-11-25/basic/utilities/cancellation
 * @module server/handlers
 */

// ============================================================================
// Core Types and Constants
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
} from './core/index.js';

export {
  HANDLER_NAMES,
  HANDLER_LOG_COMPONENTS,
  MCP_SPEC_URLS,
  MCP_SPEC_VERSION,
  HandlerLogMessages,
} from './core/index.js';

// ============================================================================
// Handler Setup Functions
// ============================================================================

export { setupPingHandler } from './ping.js';
export { setupCancellationHandler } from './cancellation.js';

// ============================================================================
// Handler Definitions
// ============================================================================

export { pingHandler } from './ping.js';
export { cancellationHandler } from './cancellation.js';
