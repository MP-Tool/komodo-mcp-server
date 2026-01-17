/**
 * Application Error Messages
 *
 * Centralized message registry for application-specific errors.
 * Contains messages for:
 * - Komodo API errors
 * - Authentication errors
 * - Resource not found errors
 * - Connection errors
 *
 * @module app/errors/messages
 */

import { interpolate } from '../framework.js';

// ============================================================================
// App Message Definitions
// ============================================================================

/**
 * Application error message definitions.
 *
 * Template syntax: `{variableName}` for interpolation
 */
export const AppMessages = {
  // ─────────────────────────────────────────────────────────────────────────
  // API Errors
  // ─────────────────────────────────────────────────────────────────────────
  API_REQUEST_FAILED: 'API request failed',
  API_REQUEST_FAILED_REASON: 'API request failed: {reason}',
  API_REQUEST_FAILED_STATUS: 'API request failed with status {status}: {message}',
  API_RESPONSE_INVALID: 'Invalid API response',
  API_RESPONSE_PARSE_ERROR: 'Failed to parse API response',

  // ─────────────────────────────────────────────────────────────────────────
  // Authentication Errors
  // ─────────────────────────────────────────────────────────────────────────
  AUTH_FAILED: 'Authentication failed',
  AUTH_FAILED_REASON: 'Authentication failed: {reason}',
  AUTH_INVALID_CREDENTIALS: 'Invalid credentials provided',
  AUTH_TOKEN_EXPIRED: 'Authentication token has expired',
  AUTH_TOKEN_INVALID: 'Invalid authentication token',
  AUTH_TOKEN_MISSING: 'Authentication token is missing',
  AUTH_UNAUTHORIZED: 'Unauthorized access',
  AUTH_FORBIDDEN: 'Access forbidden',
  AUTH_LOGIN_FAILED: 'Login failed with status {status}: {statusText}',
  AUTH_NO_TOKEN: 'Server did not return an authentication token',

  // ─────────────────────────────────────────────────────────────────────────
  // Connection Errors
  // ─────────────────────────────────────────────────────────────────────────
  CONNECTION_FAILED: 'Failed to connect to {target}',
  CONNECTION_REFUSED: 'Connection to {target} was refused',
  CONNECTION_TIMEOUT: 'Connection to {target} timed out',
  CONNECTION_HEALTH_CHECK_FAILED: 'Health check failed: {reason}',

  // ─────────────────────────────────────────────────────────────────────────
  // Resource Not Found Errors
  // ─────────────────────────────────────────────────────────────────────────
  RESOURCE_NOT_FOUND: "Resource '{resource}' not found",
  RESOURCE_NOT_FOUND_TYPE: "{resourceType} '{resourceId}' not found",
  SERVER_NOT_FOUND: "Server '{server}' not found",
  CONTAINER_NOT_FOUND: "Container '{container}' not found",
  STACK_NOT_FOUND: "Stack '{stack}' not found",
  DEPLOYMENT_NOT_FOUND: "Deployment '{deployment}' not found",

  // ─────────────────────────────────────────────────────────────────────────
  // Client Configuration Errors
  // ─────────────────────────────────────────────────────────────────────────
  CLIENT_NOT_CONFIGURED: 'Komodo client is not configured. Use komodo_configure to set up connection.',
  CLIENT_NOT_CONNECTED: 'Komodo client is not connected. Check configuration and connectivity.',
  CLIENT_CONFIGURATION_INVALID: 'Invalid client configuration: {reason}',
} as const;

export type AppMessageKey = keyof typeof AppMessages;

// ============================================================================
// Message Access
// ============================================================================

/**
 * Interpolation parameters type.
 */
export type MessageParams = Record<string, string | number | boolean | undefined>;

/**
 * Get an application message by key with optional interpolation.
 *
 * @param key - The message key
 * @param params - Optional parameters for interpolation
 * @returns The interpolated message string
 *
 * @example
 * ```typescript
 * // Simple message
 * getAppMessage('CLIENT_NOT_CONFIGURED')
 * // "Komodo client is not configured. Use komodo_configure to set up connection."
 *
 * // With interpolation
 * getAppMessage('SERVER_NOT_FOUND', { server: 'my-server' })
 * // "Server 'my-server' not found"
 * ```
 */
export function getAppMessage(key: AppMessageKey, params?: MessageParams): string {
  const template = AppMessages[key];
  if (!params) {
    return template;
  }
  return interpolate(template, params);
}
