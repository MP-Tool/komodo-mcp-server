/**
 * Server Module
 *
 * Exports server-related utilities for the MCP Framework.
 * This module is designed to be generic and client-agnostic.
 *
 * For Komodo-specific features, use imports from '../app/index.js':
 * - komodoConnectionManager
 * - initializeKomodoClientFromEnv
 *
 * @module server
 */

// ─────────────────────────────────────────────────────────────────────────────
// Server Builder (main entry point for creating servers)
// ─────────────────────────────────────────────────────────────────────────────

export { McpServerBuilder } from './builder/index.js';

export type {
  // Builder interface
  IServerBuilder,
  IBuilderState,
  // Tool types
  IToolDefinition,
  IToolProvider,
  // Resource types
  IResourceDefinition,
  IResourceTemplateDefinition,
  IResourceContent,
  ITextResourceContent,
  IBlobResourceContent,
  IResourceProvider,
  // Prompt types
  IPromptDefinition,
  IPromptArgumentDefinition,
  IPromptMessageDefinition,
  IPromptResult,
  IPromptProvider,
} from './builder/index.js';

export {
  createBuilderState,
  BuilderMessages,
  BuilderLogMessages,
  DEFAULT_SERVER_NAME,
  DEFAULT_SERVER_VERSION,
  BUILDER_LOG_COMPONENT,
} from './builder/index.js';

// ─────────────────────────────────────────────────────────────────────────────
// Session Management
// ─────────────────────────────────────────────────────────────────────────────

// Session management (top-level module)
export { TransportSessionManager, type HeartbeatCapableTransport, type SessionData } from './session/index.js';

// Generic API Connection (framework level - client-agnostic)
export { connectionManager, requestManager, ConnectionStateManager, RequestManager } from './connection/index.js';

// Server types (generic interfaces)
export type {
  // API Client
  IApiClient,
  IHealthCheckResult,
  HealthStatus,
  ApiClientFactory,
  // Tool Context
  IToolContext,
  ProgressData,
  ProgressReporter,
  ToolHandler,
  // Lifecycle
  ServerState,
  ServerLifecycleEventType,
  ServerLifecycleEvent,
  ServerLifecycleListener,
  IServerLifecycleHooks,
  ShutdownConfig,
  ILifecycleManager,
  // Registry
  IRegistryItem,
  IRegistry,
  ITool,
  IToolRegistry,
  IResource,
  IResourceTemplate,
  IResourceRegistry,
  IPromptArgument,
  IPromptMessage,
  IPrompt,
  IPromptRegistry,
  // Server Options
  TransportMode,
  HttpTransportOptions,
  TransportOptions,
  ServerCapabilities,
  IServerOptions,
  IServerInstance,
} from './types/index.js';

export { isApiClient, SERVER_STATES, DEFAULT_SHUTDOWN_CONFIG, DEFAULT_CAPABILITIES } from './types/index.js';

// Connection types
export type {
  // Connection State Types
  ConnectionState,
  ConnectionStateListener,
  ConnectionStateEvent,
  ConnectionStateStats,
  // Request Manager Types
  RequestId,
  ProgressToken,
  ActiveRequest,
  RequestManagerStats,
  ProgressNotificationParams,
  RateLimitEntry,
  // Connection Error Types
  ConnectionErrorCode,
  ConnectionErrorOptions,
} from './connection/index.js';

// Connection error classes
export {
  ConnectionErrorCodes,
  ConnectionError,
  getMcpCodeForConnectionError,
  getHttpStatusForConnectionError,
} from './connection/index.js';

// Connection constants
export {
  CONNECTION_STATES,
  CONNECTION_STATE_CONFIG,
  REQUEST_MANAGER_CONFIG,
  CONNECTION_LOG_COMPONENTS,
  CONNECTION_MCP_SPEC,
  CONNECTION_NOTIFICATION_METHODS,
  // Log messages
  ConnectionStateLogMessages,
  RequestManagerLogMessages,
  ClientInitializerLogMessages,
} from './connection/index.js';

// Protocol handlers
export { setupCancellationHandler, setupPingHandler } from './handlers/index.js';

// Handler types and constants (for advanced usage)
export type {
  HandlerType,
  HandlerRegistrationResult,
  HandlerMetadata,
  HandlerSetupFn,
  HandlerDefinition,
  HandlerRegistry,
  PingResult,
  CancellationParams,
} from './handlers/index.js';

export {
  pingHandler,
  cancellationHandler,
  HANDLER_NAMES,
  HANDLER_LOG_COMPONENTS,
  MCP_SPEC_URLS,
  MCP_SPEC_VERSION,
  HandlerLogMessages,
} from './handlers/index.js';

// Telemetry
export {
  initializeTelemetry,
  shutdownTelemetry,
  getTelemetryConfig,
  isTelemetryEnabled,
  getTracer,
  withSpan,
  withSpanSync,
  getActiveSpan,
  addSpanAttributes,
  addSpanEvent,
  getTraceContext,
  MCP_ATTRIBUTES,
  SpanKind,
  SpanStatusCode,
  serverMetrics,
  getServerMetrics,
  ServerMetricsManager,
  METRIC_ATTRIBUTES,
  type TelemetryConfig,
  type SpanOptions,
  type ServerMetrics,
  type ServerStats,
} from './telemetry/index.js';

// Transport
export { startHttpServer, type HttpServerOptions } from './transport/index.js';

// Logger (framework logger)
export {
  Logger,
  logger,
  mcpLogger,
  McpNotificationLogger,
  configureLogger,
  getLoggerConfig,
  type LogLevel,
  type ILogger,
  type ILogWriter,
  type LoggerConfig,
} from './logger/index.js';

// Config (framework configuration)
export {
  FRAMEWORK_CONFIG,
  createServerConfig,
  SERVER_CONFIG_DEFAULTS,
  frameworkEnvSchema,
  parseFrameworkEnv,
  type ServerConfig,
  type ServerConfigOptions,
  type FrameworkEnvConfig,
} from './config/index.js';

// Errors (framework error system)
export {
  // Base
  AppError,
  ErrorCodes,
  HttpStatus,
  JsonRpcErrorCode,
  // Categories
  McpProtocolError,
  SessionError,
  TransportError,
  ValidationError,
  ConfigurationError,
  InternalError,
  RegistryError,
  OperationError,
  OperationCancelledError,
  // Factory
  FrameworkErrorFactory,
  // Messages
  FrameworkMessages,
  getFrameworkMessage,
  interpolate,
  // Types
  type ErrorCodeType,
  type BaseErrorOptions,
  type ValidationErrorOptions,
  type ValidationIssue,
  type SerializedError,
  type FrameworkErrorFactoryType,
} from './errors/index.js';

// Utils (framework utilities)
export { parseEnvBoolean, getEnvString, getEnvOptional } from './utils/index.js';
