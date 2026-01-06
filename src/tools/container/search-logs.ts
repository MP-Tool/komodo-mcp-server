import { z } from 'zod';
import { Tool } from '../base.js';
import { LOG_SEARCH_DEFAULTS, ERROR_MESSAGES } from '../../config/constants.js';
import { PARAM_DESCRIPTIONS, LOG_DESCRIPTIONS } from '../../config/descriptions.js';

/**
 * Tool to search container logs with client-side filtering.
 */
export const searchContainerLogsTool: Tool = {
  name: 'komodo_search_logs',
  description:
    'Search container logs for specific patterns or keywords. Retrieves logs and filters them client-side. Returns matching lines with a count of matches.',
  schema: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID_WHERE_CONTAINER_RUNS),
    container: z.string().describe(PARAM_DESCRIPTIONS.CONTAINER_ID_FOR_SEARCH),
    query: z.string().describe(LOG_DESCRIPTIONS.SEARCH_QUERY),
    tail: z
      .number()
      .int()
      .positive()
      .optional()
      .default(LOG_SEARCH_DEFAULTS.TAIL)
      .describe(LOG_DESCRIPTIONS.TAIL_LINES_FOR_SEARCH(LOG_SEARCH_DEFAULTS.TAIL)),
    caseSensitive: z
      .boolean()
      .optional()
      .default(LOG_SEARCH_DEFAULTS.CASE_SENSITIVE)
      .describe(LOG_DESCRIPTIONS.CASE_SENSITIVE(LOG_SEARCH_DEFAULTS.CASE_SENSITIVE)),
  }),
  handler: async (args, { client }) => {
    if (!client) throw new Error(ERROR_MESSAGES.CLIENT_NOT_INITIALIZED);

    const result = await client.containers.logs(args.server, args.container, args.tail, false);

    // Combine stdout and stderr for searching
    const logContent = result.stdout + (result.stderr ? '\n' + result.stderr : '');

    // Split log content into lines for filtering
    const lines = logContent.split('\n');
    const query = args.caseSensitive ? args.query : args.query.toLowerCase();

    const filteredLines = lines.filter((line) => {
      const searchLine = args.caseSensitive ? line : line.toLowerCase();
      return searchLine.includes(query);
    });

    const matchCount = filteredLines.length;
    const filteredContent = filteredLines.join('\n');

    return {
      content: [
        {
          type: 'text',
          text: `Found ${matchCount} matching line(s):\n\n${filteredContent}`,
        },
      ],
    };
  },
};
