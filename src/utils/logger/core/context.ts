/**
 * Logger Context Management Module
 *
 * Provides robust context management for correlated logging using AsyncLocalStorage.
 * Enables automatic log enrichment with request/session context across async boundaries.
 *
 * Key features:
 * - Automatic context propagation through async operations
 * - Hierarchical context support (parent/child relationships)
 * - Thread-safe context isolation (depth tracked per-context, not globally)
 * - Memory-efficient context management
 *
 * @module logger/core/context
 */

import { AsyncLocalStorage } from 'async_hooks';
import type { LogContext } from './types.js';
import { MAX_CONTEXT_DEPTH, COMPONENT_SEPARATOR } from './constants.js';

// ============================================================================
// Context Storage
// ============================================================================

/**
 * AsyncLocalStorage instance for maintaining logging context.
 * This allows context to flow through async operations automatically
 * without explicit passing of context objects.
 *
 * @internal
 */
const contextStorage = new AsyncLocalStorage<LogContext>();

// ============================================================================
// Core Context Functions
// ============================================================================

/**
 * Run a function within a logging context.
 *
 * All logs within the function (and any async operations it spawns)
 * will automatically include the provided context. This is the primary
 * way to establish context for a request or operation.
 *
 * Thread-safety: Depth is tracked within the context object itself,
 * making it safe for concurrent operations across different async contexts.
 *
 * @param context - The context to use for logging
 * @param fn - The function to execute within the context
 * @returns The result of the function
 * @throws Error if maximum context depth is exceeded
 *
 * @example
 * ```typescript
 * const result = runWithContext(
 *   { requestId: 'req-123', sessionId: 'sess-456' },
 *   async () => {
 *     logger.info('Processing request'); // Includes requestId and sessionId
 *     return await processRequest();
 *   }
 * );
 * ```
 */
export function runWithContext<T>(context: LogContext, fn: () => T): T {
  // Get current depth from parent context (if any) or start at 0
  const parentContext = contextStorage.getStore();
  const parentDepth = parentContext?._depth ?? 0;
  const newDepth = parentDepth + 1;

  if (newDepth > MAX_CONTEXT_DEPTH) {
    throw new Error(`Maximum context depth (${MAX_CONTEXT_DEPTH}) exceeded. Possible infinite recursion.`);
  }

  // Create new context with incremented depth (thread-safe: each context has its own depth)
  const contextWithDepth: LogContext = {
    ...context,
    _depth: newDepth,
  };

  return contextStorage.run(contextWithDepth, fn);
}

/**
 * Get the current logging context.
 *
 * Returns undefined if called outside of a context established by `runWithContext`.
 *
 * @returns The current context or undefined
 *
 * @example
 * ```typescript
 * const context = getContext();
 * if (context?.requestId) {
 *   console.log(`Request: ${context.requestId}`);
 * }
 * ```
 */
export function getContext(): LogContext | undefined {
  return contextStorage.getStore();
}

/**
 * Get a specific value from the current context.
 *
 * Convenience function for accessing individual context properties
 * without retrieving the entire context object.
 *
 * @param key - The context property to retrieve
 * @returns The value or undefined if not in context or key doesn't exist
 *
 * @example
 * ```typescript
 * const requestId = getContextValue('requestId');
 * const component = getContextValue('component') ?? 'unknown';
 * ```
 */
export function getContextValue<K extends keyof LogContext>(key: K): LogContext[K] | undefined {
  return contextStorage.getStore()?.[key];
}

/**
 * Check if currently running within a logging context.
 *
 * @returns true if inside a context established by `runWithContext`
 *
 * @example
 * ```typescript
 * if (hasContext()) {
 *   // Safe to access context values
 * }
 * ```
 */
export function hasContext(): boolean {
  return contextStorage.getStore() !== undefined;
}

// ============================================================================
// Context Manipulation Functions
// ============================================================================

/**
 * Create a new context by merging additional values with the current context.
 *
 * This is useful for adding context without losing existing values.
 * If called outside a context, returns only the additional context.
 *
 * @param additionalContext - Context values to add/override
 * @returns A new merged context (does not modify current context)
 *
 * @example
 * ```typescript
 * const newContext = mergeContext({ component: 'api', traceId: 'trace-123' });
 * runWithContext(newContext, () => {
 *   // Has both original context + new values
 * });
 * ```
 */
export function mergeContext(additionalContext: Partial<LogContext>): LogContext {
  const current = contextStorage.getStore() ?? {};
  return { ...current, ...additionalContext };
}

/**
 * Create a child context that inherits from the current context.
 *
 * The child context inherits all parent values but can override specific ones.
 * Component names are automatically concatenated with a separator.
 *
 * @param childContext - Context values for the child
 * @returns A new child context
 *
 * @example
 * ```typescript
 * // Parent has component: 'api'
 * const childCtx = createChildContext({ component: 'handlers' });
 * // childCtx.component = 'api.handlers'
 * ```
 */
export function createChildContext(childContext: Partial<LogContext>): LogContext {
  const parent = contextStorage.getStore() ?? {};

  // Merge component names if both exist
  let component = childContext.component;
  if (parent.component && childContext.component) {
    component = `${parent.component}${COMPONENT_SEPARATOR}${childContext.component}`;
  } else {
    component = childContext.component ?? parent.component;
  }

  return {
    ...parent,
    ...childContext,
    component,
  };
}

/**
 * Execute a function with an extended context (adds to current context).
 *
 * Combines `mergeContext` and `runWithContext` for convenience.
 * This is the preferred way to add context for a sub-operation.
 *
 * @param additionalContext - Context values to add
 * @param fn - The function to execute
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * await withExtendedContext({ operation: 'create' }, async () => {
 *   logger.info('Creating resource'); // Includes operation: 'create'
 *   return await createResource();
 * });
 * ```
 */
export function withExtendedContext<T>(additionalContext: Partial<LogContext>, fn: () => T): T {
  const merged = mergeContext(additionalContext);
  return runWithContext(merged, fn);
}

/**
 * Execute a function with a child context.
 *
 * Combines `createChildContext` and `runWithContext` for convenience.
 * Useful for creating hierarchical logging scopes.
 *
 * @param childContext - Context values for the child scope
 * @param fn - The function to execute
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * await withChildContext({ component: 'validation' }, async () => {
 *   logger.info('Validating input'); // component: 'api.validation'
 *   return await validateInput();
 * });
 * ```
 */
export function withChildContext<T>(childContext: Partial<LogContext>, fn: () => T): T {
  const child = createChildContext(childContext);
  return runWithContext(child, fn);
}

// ============================================================================
// Context Utilities
// ============================================================================

/**
 * Get the current context depth.
 *
 * Thread-safe: reads depth from the current async context.
 * Returns 0 if called outside of any context.
 *
 * @returns The current context nesting depth
 */
export function getContextDepth(): number {
  return contextStorage.getStore()?._depth ?? 0;
}

/**
 * Reset context state (for testing purposes only).
 *
 * Note: With per-context depth tracking, this is now a no-op.
 * Each context manages its own depth, so there's no global state to reset.
 * Kept for backward compatibility with existing tests.
 *
 * @internal
 * @deprecated No longer needed - depth is per-context, not global
 */
export function _resetContextState(): void {
  // No-op: depth is now tracked per-context in _depth field
  // This function is kept for backward compatibility
}
