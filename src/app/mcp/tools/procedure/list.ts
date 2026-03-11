import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listProceduresTool: Tool = {
  name: 'komodo_list_procedures',
  description:
    'List all procedures in Komodo. Procedures are multi-step workflows with parallel stages and sequential ordering, optionally CRON-scheduled.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_procedures');
    const procedures = await wrapApiCall(
      'listProcedures',
      () => komodoClient.procedures.list({ signal: abortSignal }),
      abortSignal,
    );
    const list =
      procedures.map((p) => `• ${p.name} (${p.id}) - Tags: ${p.tags?.join(', ') || 'none'}`).join('\n') ||
      'No procedures found.';
    return successResponse(`📋 Procedures:\n\n${list}`);
  },
};
