---
applyTo: "**/*.ts"
description: Logger usage and logging standards
---

# Logging Guidelines

## Logger Import

Always import from `mcp-server-framework` and create a child logger:

```typescript
import { logger as baseLogger } from "mcp-server-framework";

const logger = baseLogger.child({ component: "tools" });
```

## Log Levels

| Level | Usage |
|-------|-------|
| `error` | Errors that impact functionality |
| `warn` | Potential problems, operation continues |
| `info` | Important operations (start, stop, connect, configure) |
| `debug` | Debugging details (API responses, state changes) |
| `trace` | Very detailed logs for tracing execution flow (use sparingly) |

## Structured Logging

```typescript
// ✅ Structured context as second argument
logger.info("Tool executed", { name: toolName, duration: ms });
logger.error("API request failed", { error: err.message, endpoint });

// ✅ Printf-style placeholders
logger.info("Container %s started on %s", containerName, serverName);

// ❌ Never use console.log — stdout is reserved for MCP protocol data
console.log("Debug:", data);
```

## Secret Scrubbing

The framework logger automatically scrubs sensitive fields:
- `password`, `secret`, `token`, `apiKey`
- `authorization`, `credentials`
- JWT tokens, Bearer tokens

Even with automatic scrubbing, avoid passing sensitive data to log calls.

## Stdio Constraint

In Stdio transport mode, **all logs go to stderr**. `stdout` is reserved exclusively for MCP protocol messages. The framework handles this automatically — using the `logger` instead of `console.log` is sufficient.
