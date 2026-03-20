/**
 * Container Operations Schema
 *
 * Zod schemas for Komodo container operations.
 * Provides detailed descriptions for AI agents to understand container management.
 */

import { z } from 'zod';
import { PARAM_DESCRIPTIONS, PRUNE_TARGET_DESCRIPTIONS } from '../../../config/index.js';

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
 * Container Action Schema
 * Common schema for container lifecycle operations
 */
export const containerActionSchema = z
  .object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
  })
  .describe('Identifies a container for lifecycle operations (start, stop, restart, pause, unpause)');
