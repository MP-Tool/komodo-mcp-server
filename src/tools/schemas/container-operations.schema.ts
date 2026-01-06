/**
 * Container Operations Schema
 *
 * Zod schemas for Komodo container operations.
 * Provides detailed descriptions for AI agents to understand container management.
 */

import { z } from 'zod';
import { PARAM_DESCRIPTIONS, PRUNE_TARGET_DESCRIPTIONS, LOG_DESCRIPTIONS } from '../../config/descriptions.js';
import { CONTAINER_LOGS_DEFAULTS, LOG_SEARCH_DEFAULTS } from '../../config/constants.js';

/**
 * Prune Target Schema
 * Defines what Docker resources can be pruned
 */
export const pruneTargetSchema = z.enum(['containers', 'images', 'volumes', 'networks', 'system', 'all']).describe(
  `Type of Docker resource to prune:
- containers: ${PRUNE_TARGET_DESCRIPTIONS.CONTAINERS}
- images: ${PRUNE_TARGET_DESCRIPTIONS.IMAGES}
- volumes: ${PRUNE_TARGET_DESCRIPTIONS.VOLUMES}
- networks: ${PRUNE_TARGET_DESCRIPTIONS.NETWORKS}
- system: ${PRUNE_TARGET_DESCRIPTIONS.SYSTEM}
- all: ${PRUNE_TARGET_DESCRIPTIONS.ALL}`,
);

/**
 * Container Log Options Schema
 */
export const containerLogOptionsSchema = z
  .object({
    tail: z.number().int().positive().optional().describe(LOG_DESCRIPTIONS.TAIL_LINES(CONTAINER_LOGS_DEFAULTS.TAIL)),
    timestamps: z.boolean().optional().describe(LOG_DESCRIPTIONS.TIMESTAMPS(CONTAINER_LOGS_DEFAULTS.TIMESTAMPS)),
  })
  .describe('Options for retrieving container logs');

/**
 * Log Search Options Schema
 */
export const logSearchOptionsSchema = z
  .object({
    query: z.string().describe(LOG_DESCRIPTIONS.SEARCH_QUERY),
    tail: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(LOG_DESCRIPTIONS.TAIL_LINES_FOR_SEARCH(LOG_SEARCH_DEFAULTS.TAIL)),
    caseSensitive: z.boolean().optional().describe(LOG_DESCRIPTIONS.CASE_SENSITIVE(LOG_SEARCH_DEFAULTS.CASE_SENSITIVE)),
  })
  .describe('Options for searching container logs');

/**
 * Container Action Schema
 * Common schema for container lifecycle operations
 */
export const containerActionSchema = z
  .object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
  })
  .describe('Identifies a container for lifecycle operations (start, stop, restart, pause, unpause)');

/**
 * Container Inspect Schema
 */
export const containerInspectSchema = z
  .object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_INSPECT),
  })
  .describe(
    'Get detailed low-level information about a container including configuration, state, and network settings',
  );

/**
 * Container List Schema
 */
export const containerListSchema = z
  .object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_TO_LIST_CONTAINERS),
  })
  .describe('List all Docker containers on a server, including stopped containers');
