/**
 * Komodo MCP specific Telemetry Constants
 *
 * Application-specific semantic attribute names for Komodo operations.
 * These extend the generic MCP_ATTRIBUTES from the framework layer.
 *
 * @module app/telemetry
 */

/**
 * Komodo-specific semantic attribute names.
 * These extend the framework's MCP_ATTRIBUTES for Komodo-specific tracing.
 *
 * @example
 * ```typescript
 * import { KOMODO_ATTRIBUTES } from './app/telemetry.js';
 * import { MCP_ATTRIBUTES } from './server/telemetry/index.js';
 *
 * span.setAttribute(MCP_ATTRIBUTES.TOOL_NAME, 'container_start');
 * span.setAttribute(KOMODO_ATTRIBUTES.SERVER, 'my-server');
 * span.setAttribute(KOMODO_ATTRIBUTES.RESOURCE_TYPE, 'container');
 * ```
 */
export const KOMODO_ATTRIBUTES = {
  /** Komodo server being accessed */
  SERVER: 'komodo.server',
  /** Komodo resource type (container, deployment, stack, server) */
  RESOURCE_TYPE: 'komodo.resource.type',
  /** Komodo resource identifier */
  RESOURCE_ID: 'komodo.resource.id',
} as const;

/**
 * Type for Komodo attribute keys.
 */
export type KomodoAttributeKey = keyof typeof KOMODO_ATTRIBUTES;

/**
 * Type for Komodo attribute values.
 */
export type KomodoAttributeValue = (typeof KOMODO_ATTRIBUTES)[KomodoAttributeKey];
