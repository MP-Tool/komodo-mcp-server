/**
 * Application Error Messages
 *
 * Centralized message registry for Komodo-specific errors.
 *
 * @module errors/messages
 */

import { interpolate, type MessageParams } from "mcp-server-framework";

// ============================================================================
// Message Definitions
// ============================================================================

export const AppMessages = {
  // API
  API_REQUEST_FAILED: "API request failed",
  API_REQUEST_FAILED_REASON: "API request failed: {reason}",
  API_REQUEST_FAILED_STATUS: "API request failed with status {status}: {message}",
  API_RESPONSE_INVALID: "Invalid API response",
  API_RESPONSE_PARSE_ERROR: "Failed to parse API response",

  // Auth
  AUTH_FAILED: "Authentication failed",
  AUTH_FAILED_REASON: "Authentication failed: {reason}",
  AUTH_INVALID_CREDENTIALS: "Invalid credentials provided",
  AUTH_TOKEN_EXPIRED: "Authentication token has expired",
  AUTH_TOKEN_INVALID: "Invalid authentication token",
  AUTH_TOKEN_MISSING: "Authentication token is missing",
  AUTH_UNAUTHORIZED: "Unauthorized access",
  AUTH_FORBIDDEN: "Access forbidden",
  AUTH_LOGIN_FAILED: "Login failed with status {status}: {statusText}",
  AUTH_NO_TOKEN: "Server did not return an authentication token",

  // Connection
  CONNECTION_FAILED: "Failed to connect to {target}",
  CONNECTION_REFUSED: "Connection to {target} was refused",
  CONNECTION_TIMEOUT: "Connection to {target} timed out",
  CONNECTION_HEALTH_CHECK_FAILED: "Health check failed: {reason}",

  // Resources
  RESOURCE_NOT_FOUND: "Resource '{resource}' not found",
  RESOURCE_NOT_FOUND_TYPE: "{resourceType} '{resourceId}' not found",
  SERVER_NOT_FOUND: "Server '{server}' not found",
  CONTAINER_NOT_FOUND: "Container '{container}' not found",
  STACK_NOT_FOUND: "Stack '{stack}' not found",
  DEPLOYMENT_NOT_FOUND: "Deployment '{deployment}' not found",

  // Client
  CLIENT_NOT_CONFIGURED: "Komodo client is not configured. Set [komodo] in config.toml or sign in via OAuth.",
  CLIENT_NOT_CONNECTED: "Komodo client is not connected. Check configuration and connectivity.",
  CLIENT_CONFIGURATION_INVALID: "Invalid client configuration: {reason}",

  // Destructive-action confirmation
  CONFIRM_DECLINED: "Destructive action not confirmed by the user ({outcome}): {action} {resourceType} '{resourceId}'",
  CONFIRM_UNAVAILABLE:
    "Destructive action blocked: {action} {resourceType} '{resourceId}' requires manual confirmation, " +
    "but this client cannot prompt for it (no MCP elicitation support).",
} as const;

export type AppMessageKey = keyof typeof AppMessages;
export type { MessageParams };

export function getAppMessage(key: AppMessageKey, params?: MessageParams): string {
  const template = AppMessages[key];
  return params ? interpolate(template, params) : template;
}
