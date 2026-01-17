/**
 * Connection Module Constants
 *
 * Centralized constants for the Komodo API connection module including:
 * - Configuration values
 * - Log component identifiers
 * - MCP specification references
 * - Log messages
 *
 * @module server/connection/core/constants
 */

// ============================================================================
// Configuration Constants
// ============================================================================

/**
 * Connection state configuration constants.
 */
export const CONNECTION_STATE_CONFIG = {
  /**
   * Maximum number of state transitions to keep in history.
   * Uses circular buffer for O(1) operations.
   */
  MAX_HISTORY_SIZE: 10,

  /**
   * Default timeout for health checks in milliseconds.
   */
  HEALTH_CHECK_TIMEOUT_MS: 30_000,
} as const;

/**
 * Request manager configuration constants.
 */
export const REQUEST_MANAGER_CONFIG = {
  /**
   * Minimum interval between progress notifications in milliseconds.
   * Used to prevent flooding the client with too many updates.
   *
   * @see https://spec.modelcontextprotocol.io/specification/2025-11-25/server/utilities/progress/
   */
  PROGRESS_MIN_INTERVAL_MS: 100,
} as const;

// ============================================================================
// Log Component Identifiers
// ============================================================================

/**
 * Logger component identifiers for the connection module.
 * Used for consistent log categorization.
 */
export const CONNECTION_LOG_COMPONENTS = {
  /** Connection state manager component */
  CONNECTION_STATE: 'ConnectionStateManager',
  /** Request manager component */
  REQUEST_MANAGER: 'RequestManager',
  /** Client initializer component */
  CLIENT_INITIALIZER: 'ClientInitializer',
} as const;

// ============================================================================
// MCP Specification References
// ============================================================================

/**
 * MCP specification URLs for documentation and compliance references.
 */
export const CONNECTION_MCP_SPEC = {
  /** MCP specification version */
  VERSION: '2025-11-25',
  /** Base URL for MCP specification */
  BASE_URL: 'https://spec.modelcontextprotocol.io/specification/2025-11-25',
  /** Progress notifications specification */
  PROGRESS_URL: 'https://spec.modelcontextprotocol.io/specification/2025-11-25/server/utilities/progress/',
  /** Cancellation specification */
  CANCELLATION_URL: 'https://spec.modelcontextprotocol.io/specification/2025-11-25/basic/cancellation/',
} as const;

// ============================================================================
// Log Messages
// ============================================================================

/**
 * Centralized log messages for connection state management.
 */
export const ConnectionStateLogMessages = {
  // State transitions
  STATE_CHANGE: (from: string, to: string) => `State transition: ${from} → ${to}`,
  CONNECTING: 'Initiating connection to API server',
  CONNECTED: 'Successfully connected to API server',
  DISCONNECTED: 'Disconnected from API server',
  ERROR_STATE: (message: string) => `Connection error: ${message}`,

  // Health check
  HEALTH_CHECK_START: 'Starting health check',
  HEALTH_CHECK_SUCCESS: 'Health check passed',
  HEALTH_CHECK_FAILED: (message: string) => `Health check failed: ${message}`,
  HEALTH_CHECK_SKIPPED: 'Health check skipped',

  // Listeners
  LISTENER_ADDED: 'State change listener added',
  LISTENER_REMOVED: 'State change listener removed',
  LISTENER_ERROR: (error: string) => `Listener threw error: ${error}`,
  LISTENERS_CLEARED: 'All listeners cleared',

  // Reset
  RESET: 'Connection state manager reset to initial state',
} as const;

/**
 * Centralized log messages for request management.
 */
export const RequestManagerLogMessages = {
  // Request lifecycle
  REQUEST_REGISTERED: (id: string | number, method: string) => `Request registered: ${id} (${method})`,
  REQUEST_UNREGISTERED: (id: string | number) => `Request unregistered: ${id}`,
  REQUEST_NOT_FOUND: (id: string | number) => `Request not found: ${id}`,

  // Cancellation
  CANCELLATION_REQUESTED: (id: string | number, reason?: string) =>
    reason ? `Cancellation requested for ${id}: ${reason}` : `Cancellation requested for ${id}`,
  CANCELLATION_SUCCESS: (id: string | number) => `Request cancelled: ${id}`,
  CANCELLATION_FAILED: (id: string | number) => `Failed to cancel request: ${id}`,

  // Progress
  PROGRESS_SENT: (token: string | number, progress: number) => `Progress sent for ${token}: ${progress}`,
  PROGRESS_RATE_LIMITED: (token: string | number) => `Progress rate limited for ${token}`,
  PROGRESS_ERROR: (token: string | number, error: string) => `Progress error for ${token}: ${error}`,
  PROGRESS_NO_SERVER: 'Cannot send progress: no server configured',

  // Server
  SERVER_SET: 'MCP server reference set',
  SERVER_CLEARED: 'MCP server reference cleared',

  // Cleanup
  CLEAR_ALL: (count: number) => `Clearing ${count} active requests`,
  CLEARED: 'Request manager cleared',
} as const;

/**
 * Centralized log messages for client initialization.
 */
export const ClientInitializerLogMessages = {
  // Initialization
  INIT_START: 'Initializing API client from environment variables',
  INIT_SUCCESS: (method: string) => `Client initialized successfully using ${method}`,
  INIT_FAILED: (reason: string) => `Client initialization failed: ${reason}`,

  // Configuration
  CONFIG_MISSING: 'Missing required configuration',
  CONFIG_URL_MISSING: 'API URL environment variable not set',
  CONFIG_AUTH_MISSING: 'No authentication method configured (need API_KEY or USERNAME/PASSWORD)',

  // Authentication
  AUTH_API_KEY: 'Using API key authentication',
  AUTH_CREDENTIALS: 'Using username/password authentication',
} as const;

// ============================================================================
// Notification Methods
// ============================================================================

/**
 * MCP notification method names.
 */
export const CONNECTION_NOTIFICATION_METHODS = {
  /** Progress notification method */
  PROGRESS: 'notifications/progress',
} as const;
