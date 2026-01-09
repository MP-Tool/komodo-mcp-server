/**
 * Connection State Manager
 *
 * Manages the connection state to the Komodo server and notifies
 * listeners when the state changes. This enables dynamic tool
 * availability based on connection status.
 *
 * @module utils/connection-state
 */

import { KomodoClient } from '../api/index.js';
import { logger as baseLogger } from './logger.js';

const logger = baseLogger.child({ component: 'connection' });

/**
 * Possible connection states for the Komodo client.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Listener function type for connection state changes.
 */
export type ConnectionStateListener = (state: ConnectionState, client: KomodoClient | null, error?: Error) => void;

/**
 * Connection state change event data.
 */
export interface ConnectionStateEvent {
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
  private stateHistory: ConnectionStateEvent[] = [];
  private readonly maxHistorySize = 10;

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
   */
  getHistory(): readonly ConnectionStateEvent[] {
    return [...this.stateHistory];
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
   *
   * @param client - The authenticated Komodo client
   * @param skipHealthCheck - Skip health check validation (for testing)
   * @returns true if connection was successful
   */
  async connect(client: KomodoClient, skipHealthCheck = false): Promise<boolean> {
    this.setState('connecting');

    try {
      if (!skipHealthCheck) {
        // Validate connection with health check
        const health = await client.healthCheck();

        if (health.status !== 'healthy') {
          throw new Error(`Health check failed: ${health.message}`);
        }

        logger.info('Connection validated: %s (API v%s)', health.details?.url, health.details?.apiVersion);
      }

      this.client = client;
      this.lastError = null;
      this.setState('connected');

      return true;
    } catch (error) {
      this.lastError = error instanceof Error ? error : new Error(String(error));
      this.setState('error', this.lastError);
      logger.error('Connection failed: %s', this.lastError.message);

      return false;
    }
  }

  /**
   * Disconnect from the Komodo server.
   * Clears the client reference and sets state to 'disconnected'.
   */
  disconnect(): void {
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
    this.stateHistory = [];
  }

  /**
   * Internal method to update state and notify listeners.
   */
  private setState(newState: ConnectionState, error?: Error): void {
    const previousState = this.state;

    if (previousState === newState) {
      return; // No change
    }

    this.state = newState;

    const event: ConnectionStateEvent = {
      previousState,
      currentState: newState,
      client: this.client,
      error,
      timestamp: new Date(),
    };

    // Add to history
    this.stateHistory.push(event);
    if (this.stateHistory.length > this.maxHistorySize) {
      this.stateHistory.shift();
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
