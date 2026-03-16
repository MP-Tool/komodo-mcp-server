/**
 * Resource Copy Tools
 *
 * MCP tools for copying Komodo resources.
 * Each tool creates a duplicate of an existing resource with a new name.
 *
 * @module tools/resource-ops/copy
 */

import { z } from 'zod';
import type { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import type { CopyableResource } from '../../../api/resources/resource-ops.js';

/**
 * Configuration for a copy tool definition.
 */
interface CopyToolConfig {
  /** The Komodo resource type */
  resourceType: CopyableResource;
  /** Lowercase label used in tool name and descriptions */
  label: string;
}

/**
 * Creates a copy tool for a given resource type.
 */
function createCopyTool(config: CopyToolConfig): Tool {
  const { resourceType, label } = config;
  const toolName = `komodo_copy_${label}`;

  return {
    name: toolName,
    description: `Copy an existing ${label}, creating a duplicate with a new name`,
    schema: z.object({
      id: z.string().describe(`The ID of the ${label} to copy`),
      name: z.string().describe(`The name for the new copy`),
    }),
    handler: async (args, { client, abortSignal }) => {
      const validClient = requireClient(client, toolName);
      const result = await wrapApiCall(
        `copy${resourceType}`,
        () => validClient.resourceOps.copy(resourceType, args.id, args.name, { signal: abortSignal }),
        abortSignal,
      );
      return successResponse(
        `${resourceType} "${args.id}" copied as "${args.name}" successfully.\n\nResult:\n${JSON.stringify(result, null, 2)}`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const copyServerTool = createCopyTool({ resourceType: 'Server', label: 'server' });
export const copyDeploymentTool = createCopyTool({ resourceType: 'Deployment', label: 'deployment' });
export const copyStackTool = createCopyTool({ resourceType: 'Stack', label: 'stack' });
export const copyBuildTool = createCopyTool({ resourceType: 'Build', label: 'build' });
export const copyBuilderTool = createCopyTool({ resourceType: 'Builder', label: 'builder' });
export const copyRepoTool = createCopyTool({ resourceType: 'Repo', label: 'repo' });
export const copyResourceSyncTool = createCopyTool({ resourceType: 'ResourceSync', label: 'resource_sync' });
export const copyActionTool = createCopyTool({ resourceType: 'Action', label: 'action' });
export const copyProcedureTool = createCopyTool({ resourceType: 'Procedure', label: 'procedure' });
export const copyAlerterTool = createCopyTool({ resourceType: 'Alerter', label: 'alerter' });
