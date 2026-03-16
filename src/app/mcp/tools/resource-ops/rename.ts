/**
 * Resource Rename Tools
 *
 * MCP tools for renaming Komodo resources.
 * Each tool changes the name of an existing resource.
 *
 * @module tools/resource-ops/rename
 */

import { z } from 'zod';
import type { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import type { CopyableResource } from '../../../api/resources/resource-ops.js';

/**
 * Configuration for a rename tool definition.
 */
interface RenameToolConfig {
  /** The Komodo resource type */
  resourceType: CopyableResource;
  /** Lowercase label used in tool name and descriptions */
  label: string;
}

/**
 * Creates a rename tool for a given resource type.
 */
function createRenameTool(config: RenameToolConfig): Tool {
  const { resourceType, label } = config;
  const toolName = `komodo_rename_${label}`;

  return {
    name: toolName,
    description: `Rename an existing ${label}`,
    schema: z.object({
      id: z.string().describe(`The ID of the ${label} to rename`),
      name: z.string().describe(`The new name for the ${label}`),
    }),
    handler: async (args, { client, abortSignal }) => {
      const validClient = requireClient(client, toolName);
      const result = await wrapApiCall(
        `rename${resourceType}`,
        () => validClient.resourceOps.rename(resourceType, args.id, args.name, { signal: abortSignal }),
        abortSignal,
      );
      return successResponse(
        `${resourceType} "${args.id}" renamed to "${args.name}" successfully.\n\nResult:\n${JSON.stringify(result, null, 2)}`,
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

export const renameServerTool = createRenameTool({ resourceType: 'Server', label: 'server' });
export const renameDeploymentTool = createRenameTool({ resourceType: 'Deployment', label: 'deployment' });
export const renameStackTool = createRenameTool({ resourceType: 'Stack', label: 'stack' });
export const renameBuildTool = createRenameTool({ resourceType: 'Build', label: 'build' });
export const renameBuilderTool = createRenameTool({ resourceType: 'Builder', label: 'builder' });
export const renameRepoTool = createRenameTool({ resourceType: 'Repo', label: 'repo' });
export const renameResourceSyncTool = createRenameTool({ resourceType: 'ResourceSync', label: 'resource_sync' });
export const renameActionTool = createRenameTool({ resourceType: 'Action', label: 'action' });
export const renameProcedureTool = createRenameTool({ resourceType: 'Procedure', label: 'procedure' });
export const renameAlerterTool = createRenameTool({ resourceType: 'Alerter', label: 'alerter' });
