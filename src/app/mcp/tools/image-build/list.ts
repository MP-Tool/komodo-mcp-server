import { z } from 'zod';
import { Tool } from '../base.js';
import { requireClient, wrapApiCall, successResponse } from '../utils.js';

export const listBuildsTool: Tool = {
  name: 'komodo_list_builds',
  description:
    'List all builds in Komodo. Builds define Docker image builds from git repos with auto-versioning and registry push.',
  schema: z.object({}),
  handler: async (_args, { client, abortSignal }) => {
    const komodoClient = requireClient(client, 'komodo_list_builds');
    const builds = await wrapApiCall(
      'listBuilds',
      () => komodoClient.builds.list({ signal: abortSignal }),
      abortSignal,
    );
    const list =
      builds.map((b) => `• ${b.name} (${b.id}) - Tags: ${b.tags?.join(', ') || 'none'}`).join('\n') ||
      'No builds found.';
    return successResponse(`📋 Builds:\n\n${list}`);
  },
};
