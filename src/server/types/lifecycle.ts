/**
 * Server Lifecycle Types
 *
 * Defines lifecycle hooks and state management for MCP servers.
 * These types enable clean startup/shutdown handling and event-driven architecture.
 *
 * @module server/types/lifecycle
 */

// ============================================================================
// Lifecycle State Types
// ============================================================================

/**
 * Server lifecycle states.
 *
 * State machine:
 * ```
 * created → starting → running → stopping → stopped
 *                ↓         ↓
 *              error ←────┘
 * ```
 */
export type ServerState = 'created' | 'starting' | 'running' | 'stopping' | 'stopped' | 'error';

/**
 * All possible server states as a readonly array (for validation).
 */
export const SERVER_STATES = ['created', 'starting', 'running', 'stopping', 'stopped', 'error'] as const;

// ============================================================================
// Lifecycle Event Types
// ============================================================================

/**
 * Server lifecycle event types.
 */
export type ServerLifecycleEventType =
  | 'starting'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'error'
  | 'client-connected'
  | 'client-disconnected';

/**
 * Server lifecycle event payload.
 */
export interface ServerLifecycleEvent {
  /** Event type */
  readonly type: ServerLifecycleEventType;
  /** Timestamp of the event */
  readonly timestamp: Date;
  /** Optional error (for 'error' events) */
  readonly error?: Error;
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Listener for server lifecycle events.
 */
export type ServerLifecycleListener = (event: ServerLifecycleEvent) => void;

// ============================================================================
// Lifecycle Hooks Interface
// ============================================================================

/**
 * Lifecycle hooks for MCP servers.
 *
 * Implement these hooks to execute code at specific points in the server lifecycle.
 * All hooks are optional and async-friendly.
 *
 * @example
 * ```typescript
 * const hooks: IServerLifecycleHooks = {
 *   onStarting: async () => {
 *     await initializeDatabase();
 *   },
 *   onStarted: async () => {
 *     logger.info('Server is ready');
 *   },
 *   onStopping: async () => {
 *     await flushMetrics();
 *   },
 *   onStopped: async () => {
 *     await closeConnections();
 *   },
 * };
 * ```
 */
export interface IServerLifecycleHooks {
  /**
   * Called before server starts accepting connections.
   * Use for initialization tasks (database, cache, external services).
   */
  onStarting?: () => void | Promise<void>;

  /**
   * Called after server is fully started and accepting connections.
   * Use for logging, metrics, or notifying external systems.
   */
  onStarted?: () => void | Promise<void>;

  /**
   * Called when server begins shutdown process.
   * Use for graceful cleanup (flush buffers, notify clients).
   */
  onStopping?: () => void | Promise<void>;

  /**
   * Called after server has fully stopped.
   * Use for final cleanup (close file handles, database connections).
   */
  onStopped?: () => void | Promise<void>;

  /**
   * Called when an unhandled error occurs.
   * Use for error reporting/logging.
   */
  onError?: (error: Error) => void | Promise<void>;

  /**
   * Called when a client connects to the server.
   * Use for session initialization or connection tracking.
   */
  onClientConnected?: (sessionId: string) => void | Promise<void>;

  /**
   * Called when a client disconnects from the server.
   * Use for session cleanup or connection tracking.
   */
  onClientDisconnected?: (sessionId: string) => void | Promise<void>;
}

// ============================================================================
// Shutdown Configuration
// ============================================================================

/**
 * Configuration for graceful shutdown behavior.
 */
export interface ShutdownConfig {
  /** Maximum time to wait for graceful shutdown (ms) */
  readonly timeoutMs: number;
  /** Whether to force exit after timeout */
  readonly forceExitOnTimeout: boolean;
  /** Signals to listen for (default: ['SIGINT', 'SIGTERM']) */
  readonly signals?: ReadonlyArray<NodeJS.Signals>;
}

/**
 * Default shutdown configuration values.
 */
export const DEFAULT_SHUTDOWN_CONFIG: ShutdownConfig = {
  timeoutMs: 10_000,
  forceExitOnTimeout: true,
  signals: ['SIGINT', 'SIGTERM'],
} as const;

// ============================================================================
// Lifecycle Manager Interface
// ============================================================================

/**
 * Interface for managing server lifecycle.
 *
 * Implementations handle state transitions and hook execution.
 */
export interface ILifecycleManager {
  /** Current server state */
  readonly state: ServerState;

  /** Start the server */
  start(): Promise<void>;

  /** Stop the server gracefully */
  stop(): Promise<void>;

  /** Add a lifecycle event listener */
  addListener(listener: ServerLifecycleListener): void;

  /** Remove a lifecycle event listener */
  removeListener(listener: ServerLifecycleListener): void;
}
