import { z } from 'zod';
import { Tool } from '../base.js';
import { PARAM_DESCRIPTIONS } from '../../../config/index.js';
import { extractUpdateId } from '../../../api/utils.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';
import { formatActionResponse } from '../../../utils/index.js';

export const getProcedureTool: Tool = {
  name: 'komodo_get_procedure',
  description: 'Get detailed information about a specific procedure, including its stages and configuration.',
  schema: z.object({
    procedure: z.string().describe(PARAM_DESCRIPTIONS.PROCEDURE_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_get_procedure');
    const result = await wrapApiCall(
      'getProcedure',
      () => komodoClient.procedures.get(args.procedure, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(JSON.stringify(result, null, 2));
  },
};

export const createProcedureTool: Tool = {
  name: 'komodo_create_procedure',
  description: 'Create a new procedure. Procedures define multi-step workflows with parallel stages.',
  schema: z.object({
    name: z.string().describe(PARAM_DESCRIPTIONS.PROCEDURE_NAME),
    config: z.record(z.unknown()).optional().describe('Procedure configuration (optional)'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_create_procedure');
    const result = await wrapApiCall(
      'createProcedure',
      () => komodoClient.procedures.create(args.name, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Procedure "${args.name}" created successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const updateProcedureTool: Tool = {
  name: 'komodo_update_procedure',
  description: 'Update an existing procedure configuration (PATCH-style: only provided fields are updated).',
  schema: z.object({
    procedure: z.string().describe(PARAM_DESCRIPTIONS.PROCEDURE_ID),
    config: z.record(z.unknown()).describe('Procedure configuration fields to update'),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_update_procedure');
    const result = await wrapApiCall(
      'updateProcedure',
      () => komodoClient.procedures.update(args.procedure, args.config as never, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Procedure "${args.procedure}" updated successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const deleteProcedureTool: Tool = {
  name: 'komodo_delete_procedure',
  description: 'Delete a procedure.',
  schema: z.object({
    procedure: z.string().describe(PARAM_DESCRIPTIONS.PROCEDURE_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_delete_procedure');
    const result = await wrapApiCall(
      'deleteProcedure',
      () => komodoClient.procedures.delete(args.procedure, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(`Procedure "${args.procedure}" deleted successfully.\n\n${JSON.stringify(result, null, 2)}`);
  },
};

export const runProcedureTool: Tool = {
  name: 'komodo_run_procedure',
  description: 'Run (execute) a procedure. This triggers the multi-step workflow defined in the procedure.',
  schema: z.object({
    procedure: z.string().describe(PARAM_DESCRIPTIONS.PROCEDURE_ID),
  }),
  handler: async (args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_run_procedure');
    const result = await wrapApiCall(
      `run procedure '${args.procedure}'`,
      () => komodoClient.procedures.run(args.procedure, { signal: abortSignal }),
      abortSignal,
    );
    return successResponse(
      formatActionResponse({
        action: 'run',
        resourceType: 'procedure',
        resourceId: args.procedure,
        updateId: extractUpdateId(result),
        status: result.status,
      }),
    );
  },
};
