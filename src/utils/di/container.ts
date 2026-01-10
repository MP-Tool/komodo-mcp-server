/**
 * Dependency Injection Container
 *
 * A lightweight, type-safe dependency injection container for the Komodo MCP Server.
 * No external dependencies - pure TypeScript implementation.
 *
 * ## Features
 * - Token-based registration (string or Symbol)
 * - Singleton and Transient scopes
 * - Factory functions for lazy instantiation
 * - Type-safe resolution with generics
 * - Hierarchical containers (child scopes)
 *
 * ## Usage
 *
 * ```typescript
 * import { Container, injectable, inject } from './di/container.js';
 *
 * // Create container
 * const container = new Container();
 *
 * // Register services
 * container.register('logger', () => new Logger(), { scope: 'singleton' });
 * container.register('apiClient', () => new ApiClient(container.resolve('logger')));
 *
 * // Resolve dependencies
 * const logger = container.resolve<Logger>('logger');
 * ```
 *
 * @module di/container
 */

/**
 * Token type for identifying dependencies.
 * Can be a string literal or Symbol for unique identification.
 * The generic parameter T is used for type inference at resolve time.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- T is used for type inference at resolve() call sites
export type Token<T = unknown> = string | symbol;

/**
 * Scope determines how instances are managed.
 * - 'singleton': One instance per container (default)
 * - 'transient': New instance on every resolve
 */
export type Scope = 'singleton' | 'transient';

/**
 * Factory function that creates an instance of a dependency.
 */
export type Factory<T> = (container: Container) => T;

/**
 * Registration options for a dependency.
 */
export interface RegistrationOptions {
  /** Instance scope (default: 'singleton') */
  scope?: Scope;
}

/**
 * Internal registration record.
 */
interface Registration<T = unknown> {
  factory: Factory<T>;
  scope: Scope;
  instance?: T;
}

/**
 * Lightweight Dependency Injection Container.
 *
 * Provides inversion of control for managing application dependencies,
 * improving testability and modularity.
 *
 * @example
 * ```typescript
 * const container = new Container();
 *
 * // Register a singleton
 * container.register('config', () => loadConfig(), { scope: 'singleton' });
 *
 * // Register with dependencies
 * container.register('service', (c) => new Service(c.resolve('config')));
 *
 * // Create a child container for request scope
 * const requestContainer = container.createChild();
 * requestContainer.register('requestId', () => generateId());
 * ```
 */
export class Container {
  private registrations: Map<Token, Registration> = new Map();
  private parent?: Container;

  /**
   * Create a new container.
   * @param parent - Optional parent container for hierarchical resolution
   */
  constructor(parent?: Container) {
    this.parent = parent;
  }

  /**
   * Register a dependency with the container.
   *
   * @param token - Unique identifier for the dependency
   * @param factory - Factory function to create instances
   * @param options - Registration options (scope, etc.)
   * @returns The container for method chaining
   *
   * @example
   * ```typescript
   * container
   *   .register('logger', () => new Logger())
   *   .register('api', (c) => new Api(c.resolve('logger')));
   * ```
   */
  register<T>(token: Token<T>, factory: Factory<T>, options: RegistrationOptions = {}): this {
    const { scope = 'singleton' } = options;

    this.registrations.set(token, {
      factory,
      scope,
    });

    return this;
  }

  /**
   * Register a pre-existing instance as a singleton.
   *
   * @param token - Unique identifier for the dependency
   * @param instance - The instance to register
   * @returns The container for method chaining
   *
   * @example
   * ```typescript
   * const logger = new Logger();
   * container.registerInstance('logger', logger);
   * ```
   */
  registerInstance<T>(token: Token<T>, instance: T): this {
    this.registrations.set(token, {
      factory: () => instance,
      scope: 'singleton',
      instance,
    });

    return this;
  }

  /**
   * Resolve a dependency from the container.
   *
   * @param token - The token identifying the dependency
   * @returns The resolved instance
   * @throws Error if the dependency is not registered
   *
   * @example
   * ```typescript
   * const logger = container.resolve<Logger>('logger');
   * ```
   */
  resolve<T>(token: Token<T>): T {
    const registration = this.getRegistration<T>(token);

    if (!registration) {
      throw new Error(`Dependency not registered: ${String(token)}`);
    }

    // Return singleton instance if already created
    if (registration.scope === 'singleton' && registration.instance !== undefined) {
      return registration.instance;
    }

    // Create new instance
    const instance = registration.factory(this);

    // Cache singleton instances
    if (registration.scope === 'singleton') {
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * Try to resolve a dependency, returning undefined if not registered.
   *
   * @param token - The token identifying the dependency
   * @returns The resolved instance or undefined
   */
  tryResolve<T>(token: Token<T>): T | undefined {
    try {
      return this.resolve(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a dependency is registered.
   *
   * @param token - The token to check
   * @returns true if the dependency is registered
   */
  has(token: Token): boolean {
    return this.registrations.has(token) || (this.parent?.has(token) ?? false);
  }

  /**
   * Remove a registration from the container.
   *
   * @param token - The token to unregister
   * @returns true if the registration was removed
   */
  unregister(token: Token): boolean {
    return this.registrations.delete(token);
  }

  /**
   * Create a child container with this container as parent.
   * Child containers inherit registrations from parent but can override them.
   *
   * @returns A new child container
   *
   * @example
   * ```typescript
   * // Parent container with app-wide services
   * const appContainer = new Container();
   * appContainer.register('config', () => appConfig);
   *
   * // Child container for request scope
   * const requestContainer = appContainer.createChild();
   * requestContainer.register('requestId', () => req.id);
   * ```
   */
  createChild(): Container {
    return new Container(this);
  }

  /**
   * Clear all registrations from this container.
   * Does not affect parent container.
   */
  clear(): void {
    this.registrations.clear();
  }

  /**
   * Get all registered tokens.
   * Does not include parent container tokens.
   */
  getTokens(): Token[] {
    return Array.from(this.registrations.keys());
  }

  /**
   * Get registration from this container or parent.
   */
  private getRegistration<T>(token: Token<T>): Registration<T> | undefined {
    const registration = this.registrations.get(token) as Registration<T> | undefined;

    if (registration) {
      return registration;
    }

    // Check parent container
    if (this.parent) {
      return this.parent.getRegistration(token);
    }

    return undefined;
  }
}

/**
 * Pre-defined tokens for common dependencies.
 * Use Symbols for unique identification to avoid naming conflicts.
 */
export const TOKENS = {
  // Core services
  Logger: Symbol('Logger'),
  Config: Symbol('Config'),

  // API
  KomodoClient: Symbol('KomodoClient'),
  ApiClient: Symbol('ApiClient'),

  // Managers
  ConnectionManager: Symbol('ConnectionManager'),
  RequestManager: Symbol('RequestManager'),
  SessionManager: Symbol('SessionManager'),

  // Registries
  ToolRegistry: Symbol('ToolRegistry'),
  ResourceRegistry: Symbol('ResourceRegistry'),
  PromptRegistry: Symbol('PromptRegistry'),
} as const;

/**
 * Global application container.
 * Use this for application-wide singletons.
 * @knipignore - Intentionally exported for future DI usage
 */
export const container = new Container();

/**
 * Helper to create a typed token.
 * Useful for creating tokens with associated type information.
 *
 * @example
 * ```typescript
 * const LoggerToken = createToken<Logger>('Logger');
 * container.register(LoggerToken, () => new Logger());
 * const logger = container.resolve(LoggerToken); // Type: Logger
 * ```
 */
export function createToken<T>(name: string): Token<T> {
  return Symbol(name);
}
