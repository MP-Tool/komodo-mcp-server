---
applyTo: "**/tools/**/*.ts"
description: MCP tool implementation patterns for Komodo MCP Server
---

# Tool Implementation Guidelines

## File Organization

Tools are organized as flat files by domain in `src/tools/`:

```
tools/
├── index.ts          # Side-effect imports (auto-registration)
├── config.ts         # komodo_configure, komodo_health_check
├── container.ts      # Container tools
├── server.ts         # Server tools
├── stack.ts          # Stack tools
├── deployment.ts     # Deployment tools
├── terminal.ts       # Terminal exec tools
├── user.ts           # User tools
└── schemas/          # Shared Zod schemas
    ├── index.ts      # Barrel export
    ├── container.ts  # Container-specific schemas
    ├── server.ts     # Server-specific schemas
    ├── deployment.ts # Deployment-specific schemas
    ├── stack.ts      # Stack-specific schemas
    └── validators.ts # Shared reusable validators
```

## Tool Naming

Convention: `komodo_<domain>_<action>`

Examples: `komodo_container_start`, `komodo_list_containers`, `komodo_stack_deploy`, `komodo_configure`

## Complete Tool Example

```typescript
import { defineTool, text, z } from "mcp-server-framework";
import { PARAM_DESCRIPTIONS } from "../config/index.js";
import { requireClient, wrapApiCall } from "../utils/index.js";
import { serverIdSchema, containerNameSchema } from "./schemas/index.js";

export const startContainerTool = defineTool({
  name: "komodo_container_start",
  description: "Start a stopped container. Returns the update result.",
  input: z.object({
    server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
    container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID),
  }),
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
  },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "startContainer",
      () => komodo.client.execute("StartContainer", {
        server: args.server,
        container: args.container,
      }),
      abortSignal,
    );
    return text(formatActionResponse({ ... }));
  },
});
```

## Tool Handler Pattern

Every tool handler follows the same three-step pattern:

```typescript
handler: async (args, { abortSignal }) => {
  // 1. Get the Komodo client (throws if not configured)
  const komodo = requireClient();

  // 2. Call the API with error wrapping
  const result = await wrapApiCall("operationName", () => komodo.client.read(...), abortSignal);

  // 3. Return a formatted text response
  return text("formatted result");
},
```

## Key Utilities

| Utility | Import From | Purpose |
|---------|-------------|---------|
| `requireClient()` | `utils/index.js` | Get connected KomodoClient or throw |
| `wrapApiCall(name, fn, signal)` | `utils/index.js` | Error classification + cancellation |
| `wrapExecuteAndPoll(name, fn, signal)` | `utils/index.js` | Long-running operations with polling |
| `checkCancelled(signal, op)` | `utils/index.js` | Manual cancellation check |
| `text(content)` | `mcp-server-framework` | Text response |
| `json(data)` | `mcp-server-framework` | JSON response |
| `error(message)` | `mcp-server-framework` | Error response (`isError: true`) |

## Response Formatting

Use centralized formatters from `utils/response-formatter.ts`:

```typescript
import { formatActionResponse, formatListHeader, formatLogsResponse } from "../utils/index.js";

// For action results (start, stop, deploy, etc.)
formatActionResponse({
  action: "start",
  resourceType: "container",
  resourceId: args.container,
  serverName: args.server,
});

// For list headers
formatListHeader({ resourceType: "container", count: containers.length, serverName: args.server });
```

## Schema Best Practices

### Centralized Descriptions

Always use `PARAM_DESCRIPTIONS` from `config/descriptions.ts`:

```typescript
input: z.object({
  server: serverIdSchema.describe(PARAM_DESCRIPTIONS.SERVER_ID),
  container: containerNameSchema.describe(PARAM_DESCRIPTIONS.CONTAINER_ID),
  tail: z.number().optional().default(100).describe("Number of lines from end"),
})
```

### Shared Schemas

Reuse schemas from `tools/schemas/` — never duplicate validation logic:

```typescript
import { serverIdSchema, containerNameSchema, containerActionSchema } from "./schemas/index.js";
```

## Tool Annotations

Mark tool behavior for MCP clients:

```typescript
annotations: {
  readOnlyHint: true,       // Read operations (list, inspect, logs)
  // or
  readOnlyHint: false,
  destructiveHint: true,    // Destructive operations (stop, destroy, exec)
  // or
  idempotentHint: false,    // Non-idempotent operations (create)
}
```

## Auto-Registration

Tools register automatically via side-effect imports in `tools/index.ts`:

```typescript
// tools/index.ts
import "./config.js";
import "./container.js";
import "./server.js";
import "./stack.js";
import "./deployment.js";
import "./terminal.js";
import "./user.js";
```

Adding a new tool file: create the file with `defineTool()` calls, then add an import line to `tools/index.ts`.

## Error Handling in Tools

Tools should **not** catch errors from `wrapApiCall()` — the framework converts them to MCP error responses automatically. Only catch errors when custom recovery logic is needed.

```typescript
// ✅ Let errors propagate
const result = await wrapApiCall("op", () => komodo.client.read(...), abortSignal);

// ❌ Don't wrap in try/catch unless you need custom handling
try {
  const result = await wrapApiCall(...);
} catch (e) {
  // Only if you need fallback logic
}
```
