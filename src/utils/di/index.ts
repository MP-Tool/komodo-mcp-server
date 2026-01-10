/**
 * Dependency Injection Module
 *
 * Lightweight, type-safe dependency injection for the Komodo MCP Server.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { container, TOKENS, createToken } from './di/index.js';
 *
 * // Register dependencies
 * container.register(TOKENS.Logger, () => new Logger());
 *
 * // Resolve dependencies
 * const logger = container.resolve<Logger>(TOKENS.Logger);
 * ```
 *
 * @module di
 */

export {
  Container,
  container,
  TOKENS,
  createToken,
  type Token,
  type Scope,
  type Factory,
  type RegistrationOptions,
} from './container.js';
