/**
 * Connection State Manager
 *
 * Manages the connection state to the Komodo server and notifies
 * listeners when the state changes. This enables dynamic tool
 * availability based on connection status.
 *
 * @module utils/connection-state
 */

import { KomodoClient } from '../../api/index.js';
import { logger as baseLogger } from '../../utils/logger/logger.js';
import { withSpan, addSpanAttributes, addSpanEvent, MCP_ATTRIBUTES } from '../telemetry/index.js';
import { serverMetrics } from '../telemetry/metrics.js';

const logger = baseLogger.child({ component: 'connection' });

/**
 * Possible connection states for the Komodo client.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Listener function type for connection state changes.
 * @internal
 */
type ConnectionStateListener = (state: ConnectionState, client: KomodoClient | null, error?: Error) => void;

/**
 * Connection state change event data.
 * @internal
 */
interface ConnectionStateEvent {
  /** Previous connection state */
  previousState: ConnectionState;
  /** Current connection state */
  currentState: ConnectionState;
  /** The Komodo client instance (null if disconnected) */
  client: KomodoClient | null;
  /** Error details if state is 'error' */
  error?: Error;
  /** Timestamp of the state change */
  timestamp: Date;
}

/**
 * Manages the connection state to the Komodo server.
 *
 * Features:
 * - Tracks connection state (disconnected, connecting, connected, error)
 * - Notifies listeners when state changes
 * - Provides current client instance
 * - Supports health check validation
 * - Uses circular buffer for efficient history management (O(1) operations)
 *
 * @example
 * ```typescript
 * connectionManager.onStateChange((state, client) => {
 *   if (state === 'connected') {
 *     console.log('Connected to Komodo!');
 *   }
 * });
 *
 * await connectionManager.connect(komodoClient);
 * ```
 */
class ConnectionStateManager {
  private state: ConnectionState = 'disconnected';
  private client: KomodoClient | null = null;
  private lastError: Error | null = null;
  private listeners: Set<ConnectionStateListener> = new Set();

  // Performance: Use circular buffer instead of array with shift()
  // shift() is O(n), circular buffer is O(1)
  private readonly maxHistorySize = 10;
  private stateHistory: (ConnectionStateEvent | null)[] = new Array(this.maxHistorySize).fill(null);
  private historyIndex = 0;
  private historyCount = 0;

  /**
   * Get the current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get the current Komodo client instance.
   * Returns null if not connected.
   */
  getClient(): KomodoClient | null {
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
  getHistory(): readonly ConnectionStateEvent[] {
    // Reconstruct array from circular buffer in chronological order
    const result: ConnectionStateEvent[] = [];
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
  onStateChange(listener: ConnectionStateListener): () => void {
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
   * @param client - The authenticated Komodo client
   * @param skipHealthCheck - Skip health check validation (for testing)
   * @returns true if connection was successful
   */
  async connect(client: KomodoClient, skipHealthCheck = false): Promise<boolean> {
    return withSpan('komodo.connection.connect', async (span) => {
      this.setState('connecting');
      addSpanAttributes({
        [MCP_ATTRIBUTES.OPERATION]: 'connect',
        'connection.skip_health_check': skipHealthCheck,
      });

      try {
        if (!skipHealthCheck) {
          // Validate connection with health check
          addSpanEvent('health_check.start');
          const health = await client.healthCheck();

          if (health.status !== 'healthy') {
            addSpanEvent('health_check.failed', { 'health.message': health.message || 'unknown' });
            throw new Error(`Health check failed: ${health.message}`);
          }

          addSpanEvent('health_check.success', {
            'health.url': health.details?.url || 'unknown',
            'health.api_version': health.details?.apiVersion || 'unknown',
          });

          /* v8 ignore next - optional API version logging */
          logger.info('Connection validated: %s (API v%s)', health.details?.url, health.details?.apiVersion);
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
        logger.error('Connection failed: %s', this.lastError.message);

        return false;
      }
      /* v8 ignore stop */
    });
  }

  /**
   * Disconnect from the Komodo server.
   * Clears the client reference and sets state to 'disconnected'.
   */
  disconnect(): void {
    addSpanEvent('connection.disconnect');
    this.client = null;
    this.lastError = null;
    this.setState('disconnected');
    logger.info('Disconnected from Komodo');
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

    const event: ConnectionStateEvent = {
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

    logger.debug('Connection state: %s → %s', previousState, newState);

    // Notify listeners
    for (const listener of this.listeners) {
      try {
        listener(newState, this.client, error);
      } catch (listenerError) {
        logger.error('Error in connection state listener:', listenerError);
      }
    }
  }
}

/**
 * Singleton instance of the ConnectionStateManager.
 * Use this for managing the Komodo client connection throughout the application.
 */
export const connectionManager = new ConnectionStateManager();

// Also export the class for testing
export { ConnectionStateManager };
