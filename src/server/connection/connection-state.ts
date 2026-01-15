/**
 * Connection State Manager
 *
 * Manages the connection state to an API server and notifies
 * listeners when the state changes. This enables dynamic tool
 * availability based on connection status.
 *
 * Generic implementation works with any API client implementing IApiClient.
 *
 * @module server/connection/connection-state
 */

import type { IApiClient } from '../types/index.js';
import { logger as baseLogger } from '../logger/index.js';
import { FrameworkConnectionError } from '../errors/index.js';
import { withSpan, addSpanAttributes, addSpanEvent, MCP_ATTRIBUTES } from '../telemetry/index.js';
import { serverMetrics } from '../telemetry/index.js';

// Import centralized types and constants from core
import type { ConnectionState, ConnectionStateListener, ConnectionStateEvent } from './core/types.js';
import { CONNECTION_STATE_CONFIG, CONNECTION_LOG_COMPONENTS, ConnectionStateLogMessages } from './core/constants.js';

const logger = baseLogger.child({ component: CONNECTION_LOG_COMPONENTS.CONNECTION_STATE });

// Re-export types for backwards compatibility
export type { ConnectionState } from './core/types.js';

/**
 * Manages the connection state to an API server.
 *
 * Generic implementation that works with any client implementing IApiClient.
 *
 * Features:
 * - Tracks connection state (disconnected, connecting, connected, error)
 * - Notifies listeners when state changes
 * - Provides current client instance
 * - Supports health check validation
 * - Uses circular buffer for efficient history management (O(1) operations)
 *
 * @typeParam TClient - The API client type (must implement IApiClient)
 *
 * @example
 * ```typescript
 * const manager = new ConnectionStateManager<KomodoClient>();
 * manager.onStateChange((state, client) => {
 *   if (state === 'connected') {
 *     console.log('Connected!');
 *   }
 * });
 * await manager.connect(apiClient);
 *
 * // With any IApiClient implementation
 * const genericManager = new ConnectionStateManager<MyApiClient>();
 * ```
 */
class ConnectionStateManager<TClient extends IApiClient = IApiClient> {
  private state: ConnectionState = 'disconnected';
  private client: TClient | null = null;
  private lastError: Error | null = null;
  private listeners: Set<ConnectionStateListener<TClient>> = new Set();

  // Performance: Use circular buffer instead of array with shift()
  // shift() is O(n), circular buffer is O(1)
  private readonly maxHistorySize = CONNECTION_STATE_CONFIG.MAX_HISTORY_SIZE;
  private stateHistory: (ConnectionStateEvent<TClient> | null)[] = new Array(this.maxHistorySize).fill(null);
  private historyIndex = 0;
  private historyCount = 0;

  /**
   * Get the current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get the current API client instance.
   * Returns null if not connected.
   */
  getClient(): TClient | null {
    return this.client;
  }

  /**
   * Check if the client is currently connected.
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.client !== null;
  }

  /**
   * Get the last error that occurred (if any).
   */
  getLastError(): Error | null {
    return this.lastError;
  }

  /**
   * Get the connection state history.
   * Returns the most recent state changes (up to maxHistorySize).
   * History is returned in chronological order (oldest first).
   */
  getHistory(): readonly ConnectionStateEvent<TClient>[] {
    // Reconstruct array from circular buffer in chronological order
    const result: ConnectionStateEvent<TClient>[] = [];
    for (let i = 0; i < this.historyCount; i++) {
      // Calculate the actual index in circular buffer
      const index = (this.historyIndex - this.historyCount + i + this.maxHistorySize) % this.maxHistorySize;
      const event = this.stateHistory[index];
      /* v8 ignore start - defensive check for circular buffer integrity */
      if (event) {
        result.push(event);
      }
      /* v8 ignore stop */
    }
    return result;
  }

  /**
   * Register a listener for connection state changes.
   *
   * @param listener - Function to call when state changes
   * @returns Unsubscribe function
   */
  onStateChange(listener: ConnectionStateListener<TClient>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Set the connection state to 'connecting'.
   * Call this before attempting to connect.
   */
  setConnecting(): void {
    this.setState('connecting');
  }

  /**
   * Set the client and mark as connected.
   * Validates the connection with a health check before completing.
   * Includes OpenTelemetry tracing for the connection process.
   *
   * @param client - The authenticated API client
   * @param skipHealthCheck - Skip health check validation (for testing)
   * @returns true if connection was successful
   */
  async connect(client: TClient, skipHealthCheck = false): Promise<boolean> {
    return withSpan('api.connection.connect', async (span) => {
      this.setState('connecting');
      addSpanAttributes({
        [MCP_ATTRIBUTES.OPERATION]: 'connect',
        'connection.skip_health_check': skipHealthCheck,
        'connection.client_type': client.clientType,
      });

      try {
        if (!skipHealthCheck) {
          // Validate connection with health check
          addSpanEvent('health_check.start');
          const health = await client.healthCheck();

          if (health.status !== 'healthy') {
            addSpanEvent('health_check.failed', { 'health.message': health.message || 'unknown' });
            throw FrameworkConnectionError.healthCheckFailed(health.message || 'unknown');
          }

          addSpanEvent('health_check.success', {
            'health.status': health.status,
            'health.message': health.message || 'ok',
          });

          /* v8 ignore next - optional API version logging */
          logger.info(ConnectionStateLogMessages.CONNECTED);
        }

        this.client = client;
        this.lastError = null;
        this.setState('connected');
        addSpanEvent('connection.established');

        return true;
        /* v8 ignore start - catch block for connection errors */
      } catch (error) {
        this.lastError = error instanceof Error ? error : new Error(String(error));
        this.setState('error', this.lastError);
        span.setAttribute('error.message', this.lastError.message);
        logger.error(ConnectionStateLogMessages.ERROR_STATE(this.lastError.message));

        return false;
      }
      /* v8 ignore stop */
    });
  }

  /**
   * Disconnect from the API server.
   * Clears the client reference and sets state to 'disconnected'.
   */
  disconnect(): void {
    addSpanEvent('connection.disconnect');
    this.client = null;
    this.lastError = null;
    this.setState('disconnected');
    logger.info(ConnectionStateLogMessages.DISCONNECTED);
  }

  /**
   * Set connection error state.
   *
   * @param error - The error that occurred
   */
  setError(error: Error): void {
    this.lastError = error;
    this.setState('error', error);
  }

  /**
   * Clear all listeners.
   * Useful for cleanup during shutdown.
   */
  clearListeners(): void {
    this.listeners.clear();
  }

  /**
   * Reset the connection manager to initial state.
   * Useful for testing or complete reset scenarios.
   */
  reset(): void {
    this.state = 'disconnected';
    this.client = null;
    this.lastError = null;
    this.listeners.clear();
    // Reset circular buffer
    this.stateHistory = new Array(this.maxHistorySize).fill(null);
    this.historyIndex = 0;
    this.historyCount = 0;
  }

  /**
   * Internal method to update state and notify listeners.
   * Uses circular buffer for O(1) history management.
   * Records metrics for state transitions.
   */
  private setState(newState: ConnectionState, error?: Error): void {
    const previousState = this.state;

    if (previousState === newState) {
      return; // No change
    }

    this.state = newState;

    // Record state transition in metrics
    serverMetrics.recordConnectionStateChange(previousState, newState);

    // Add telemetry event for state change
    addSpanEvent('connection.state_change', {
      'connection.state.previous': previousState,
      'connection.state.current': newState,
      'connection.error': error?.message,
    });

    const event: ConnectionStateEvent<TClient> = {
      previousState,
      currentState: newState,
      client: this.client,
      error,
      timestamp: new Date(),
    };

    // Add to circular buffer - O(1) operation instead of shift() which is O(n)
    this.stateHistory[this.historyIndex] = event;
    this.historyIndex = (this.historyIndex + 1) % this.maxHistorySize;
    if (this.historyCount < this.maxHistorySize) {
      this.historyCount++;
    }

    logger.debug(ConnectionStateLogMessages.STATE_CHANGE(previousState, newState));

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(newState, this.client, error);
      } catch (listenerError) {
        const errorMessage = listenerError instanceof Error ? listenerError.message : String(listenerError);
        logger.error(ConnectionStateLogMessages.LISTENER_ERROR(errorMessage));
      }
    }
  }
}

/**
 * Singleton instance of the ConnectionStateManager.
 * Use this for managing the API client connection throughout the application.
 *
 * Note: This uses IApiClient as the generic type for maximum flexibility.
 * For type-safe access to specific client methods, cast or use a typed manager.
 */
export const connectionManager = new ConnectionStateManager<IApiClient>();

// Also export the class for testing and custom instances
export { ConnectionStateManager };
