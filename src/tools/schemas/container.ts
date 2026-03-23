/**
 * Container Schemas
 *
 * Zod schemas for container tool inputs — prune targets and lifecycle actions.
 *
 * @module tools/schemas/container
 */

import { z } from "mcp-server-framework";
import { PARAM_DESCRIPTIONS, PRUNE_TARGET_DESCRIPTIONS } from "../../config/index.js";
import { serverIdSchema, containerNameSchema } from "./validators.js";

/** Prune target selection */
export const pruneTargetSchema = z.enum(["containers", "images", "volumes", "networks", "system", "all"]).describe(
  `Type of Docker resource to prune:
- containers: ${PRUNE_TARGET_DESCRIPTIONS.CONTAINERS}
- images: ${PRUNE_TARGET_DESCRIPTIONS.IMAGES}
- volumes: ${PRUNE_TARGET_DESCRIPTIONS.VOLUMES}
- networks: ${PRUNE_TARGET_DESCRIPTIONS.NETWORKS}
- system: ${PRUNE_TARGET_DESCRIPTIONS.SYSTEM}
- all: ${PRUNE_TARGET_DESCRIPTIONS.ALL}`,
);

/** Identifies a container for lifecycle operations (start, stop, restart, pause, unpause) */
export const containerActionSchema = z
  .object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_ACTION),
  })
  .describe("Identifies a container for lifecycle operations (start, stop, restart, pause, unpause)");
