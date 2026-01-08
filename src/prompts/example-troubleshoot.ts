/**
 * Example Prompt: Troubleshoot Container
 *
 * ============================================================================
 * ⚠️  EXAMPLE PROMPT - FOR DEMONSTRATION PURPOSES ONLY
 * ============================================================================
 *
 * This is an example prompt implementation that demonstrates:
 * - How to define and register MCP prompts
 * - Using prompt arguments for customization
 * - Building dynamic prompt content based on arguments
 * - The multi-turn conversation pattern (user + assistant messages)
 *
 * This prompt provides a troubleshooting guide template and can be used as a
 * template for creating new production prompts.
 *
 * To create a new prompt:
 * 1. Copy this file and rename it (e.g., `my-prompt.ts`)
 * 2. Update the name, description, and arguments
 * 3. Implement the handler to return your prompt messages
 * 4. Register it in `index.ts`
 *
 * @example Creating a custom prompt
 * ```typescript
 * promptRegistry.register({
 *   name: 'my-prompt',
 *   description: 'What this prompt helps with',
 *   arguments: [
 *     { name: 'param1', description: 'First parameter', required: true },
 *   ],
 *   handler: async (args) => ({
 *     messages: [
 *       { role: 'user', content: { type: 'text', text: `Help with ${args.param1}` } },
 *     ],
 *   }),
 * });
 * ```
 */

import { promptRegistry } from './base.js';

/**
 * Registers the example troubleshoot container prompt.
 *
 * This prompt demonstrates a multi-turn conversation pattern that guides
 * users through troubleshooting container issues. It shows how to:
 * - Accept multiple arguments (required and optional)
 * - Build dynamic content based on argument values
 * - Structure a helpful assistant response with actionable steps
 */
export function registerExamplePrompt(): void {
  promptRegistry.register({
    name: 'example-troubleshoot-container',
    description:
      '[Example] Helps troubleshoot a container that is not working as expected. ' +
      'Demonstrates prompt implementation with arguments and dynamic content.',
    arguments: [
      {
        name: 'container_name',
        description: 'The name or ID of the container to troubleshoot',
        required: true,
      },
      {
        name: 'server_name',
        description: 'The Komodo server where the container is running',
        required: true,
      },
      {
        name: 'issue_type',
        description: 'Type of issue: "not-starting", "crashing", "slow", "networking", "other"',
        required: false,
      },
    ],
    handler: async (args) => {
      const containerName = args.container_name || 'unknown';
      const serverName = args.server_name || 'unknown';
      const issueType = args.issue_type || 'general';

      // Build troubleshooting guide based on issue type
      const troubleshootingSteps = getTroubleshootingSteps(issueType);

      return {
        description: `[Example] Troubleshooting guide for container "${containerName}" on server "${serverName}"`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `I need help troubleshooting a container.

**Container:** ${containerName}
**Server:** ${serverName}
**Issue Type:** ${issueType}

Please help me diagnose and fix the problem.`,
            },
          },
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `I'll help you troubleshoot the container "${containerName}" on server "${serverName}".

> ⚠️ **Note:** This is an example prompt for demonstration purposes.

${troubleshootingSteps}

Let me start by gathering information about the container. I'll use the following tools:

1. First, let's check the **container status** using \`komodo_get_deployment_info\` or \`komodo_inspect_container\`
2. Then review the **container logs** using \`komodo_get_container_logs\`
3. If needed, search for specific errors using \`komodo_search_logs\`

Would you like me to proceed with these diagnostic steps?`,
            },
          },
        ],
      };
    },
  });
}

/**
 * Returns troubleshooting steps based on the issue type.
 * Demonstrates how to modularize prompt content generation.
 */
function getTroubleshootingSteps(issueType: string): string {
  switch (issueType) {
    case 'not-starting':
      return `
## Container Not Starting

1. **Check container logs** for startup errors
2. **Verify the image** exists and is accessible
3. **Check resource limits** (memory, CPU)
4. **Verify port bindings** are not conflicting
5. **Check volume mounts** exist and have correct permissions`;

    case 'crashing':
      return `
## Container Crashing

1. **Check recent logs** for crash reasons
2. **Look for OOM (Out of Memory)** kills
3. **Verify health checks** are not too aggressive
4. **Check for resource exhaustion**
5. **Review recent configuration changes**`;

    case 'slow':
      return `
## Container Running Slowly

1. **Check CPU usage** - is it maxed out?
2. **Check memory usage** - is it swapping?
3. **Check disk I/O** - slow storage?
4. **Check network latency** to dependencies
5. **Review application-level metrics**`;

    case 'networking':
      return `
## Networking Issues

1. **Verify network configuration** (bridge, host, etc.)
2. **Check DNS resolution** inside container
3. **Verify port mappings** are correct
4. **Check firewall rules** on host
5. **Test connectivity** to other containers/services`;

    default:
      return `
## General Troubleshooting

1. **Check container status** and state
2. **Review container logs** for errors
3. **Inspect container configuration**
4. **Check resource usage** (CPU, memory, disk)
5. **Verify network connectivity**`;
  }
}
