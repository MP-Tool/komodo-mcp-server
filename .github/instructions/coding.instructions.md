---
applyTo: "**"
description: General coding standards and best practices
---

# Coding Guidelines

## General Principles

- **Readable Code**: Self-documenting names for variables, functions, classes
- **DRY Principle**: No code duplication — centralize constants, messages, schemas
- **SOLID Principles**: SRP, DIP, OCP applied consistently
- **Separation of Concerns**: Config / Tools / Utils / Errors / Client are distinct layers

## Error Handling

### Error Factory Pattern

Centralized error creation via `AppErrorFactory` in `errors/factory.ts`:

```typescript
import { AppErrorFactory } from "../errors/index.js";

// Komodo-specific errors
throw AppErrorFactory.notFound.server("my-server");
throw AppErrorFactory.notFound.container(containerId);
throw AppErrorFactory.api.requestFailed("timeout exceeded");
throw AppErrorFactory.auth.invalidCredentials();
throw AppErrorFactory.client.notConfigured();

// Framework errors (delegated)
throw AppErrorFactory.validation.fieldRequired("containerId");
throw AppErrorFactory.operation.failed("deploy", "image not found");
```

### Message Registry Pattern

Centralized messages with interpolation in `errors/messages.ts`:

```typescript
import { getAppMessage } from "../errors/index.js";

getAppMessage("API_REQUEST_FAILED_REASON", { reason: "timeout" });
// → "API request failed: timeout"

getAppMessage("RESOURCE_NOT_FOUND_TYPE", { resourceType: "Container", resourceId: "nginx" });
// → "Container 'nginx' not found"
```

### API Call Wrapping

All Komodo API calls go through `wrapApiCall()` which handles error classification:

```typescript
import { requireClient, wrapApiCall } from "../utils/index.js";

const komodo = requireClient();
const result = await wrapApiCall(
  "listContainers",
  () => komodo.client.read("ListDockerContainers", { server: args.server }),
  abortSignal,
);
```

## Framework Reference

All MCP infrastructure is imported from `mcp-server-framework`. This section provides a quick reference of the most useful exports.

### Server & Tool Definition

| Export | Purpose | Usage |
|--------|---------|-------|
| `createServer(options)` | Create and start MCP server | `src/index.ts` entry point |
| `defineTool({ name, input, handler })` | Define + auto-register a tool | Every tool file |
| `z` | Zod re-export (version-safe) | Input schemas, env validation |
| `text(content)` | Text tool response | Most tool handlers |
| `json(data)` | JSON tool response | Structured data responses |
| `error(message)` | Error response (`isError: true`) | Soft error signaling |

### Logging

| Export | Purpose | Usage |
|--------|---------|-------|
| `logger` | Base framework logger | `logger.child({ component: '...' })` |
| `Logger` | Logger class (for typing) | Type annotations |

```typescript
import { logger as baseLogger } from "mcp-server-framework";
const logger = baseLogger.child({ component: "client" });
```

### Error System

| Export | Purpose | Usage |
|--------|---------|-------|
| `AppError` | Base error class | Extend for custom errors |
| `FrameworkErrorFactory` | Error factory with categories | `AppErrorFactory` extends this |
| `OperationCancelledError` | Thrown on `AbortSignal` abort | `wrapApiCall()`, `polling.ts` |
| `interpolate(template, params)` | `{var}` string interpolation | Error message registry |

```typescript
import { AppError, type BaseErrorOptions } from "mcp-server-framework";
import { FrameworkErrorFactory } from "mcp-server-framework";
import { OperationCancelledError } from "mcp-server-framework";
import { interpolate, type MessageParams } from "mcp-server-framework";
```

Subpath imports for error internals:

```typescript
import { ErrorCodes, HttpStatus } from "mcp-server-framework/errors";
```

### Configuration

| Export | Purpose | Usage |
|--------|---------|-------|
| `registerConfigSection(name, schema)` | Register app config section for config file | `config/env.ts` |
| `getAppConfig(name)` | Retrieve parsed config section at runtime | Access registered config |
| `durationSchema(default)` | Zod schema for `"30s"`, `"1m"`, `5000` | `API_TIMEOUT_MS` |
| `parseDuration(value)` | Parse duration string to ms | Utility |
| `formatDuration(ms)` | Format ms to human string | Utility |

```typescript
import { z, registerConfigSection, getAppConfig, durationSchema } from "mcp-server-framework";

// Duration: accepts "30s", "1m", "500ms", or plain number (ms)
API_TIMEOUT_MS: durationSchema("30s").pipe(z.number().int().positive()),
```

### Types

| Export | Purpose | Usage |
|--------|---------|-------|
| `ToolContext` | Handler second argument type | `{ abortSignal, reportProgress, sessionId }` |
| `ProgressReporter` | Type for `reportProgress` callback | Terminal tools, polling |
| `ToolAnnotations` | `{ readOnlyHint, destructiveHint, ... }` | Tool metadata |
| `BaseErrorOptions` | Options for `AppError` constructor | Custom error classes |

```typescript
import type { ProgressReporter, ToolContext } from "mcp-server-framework";
```

### Subpath Imports

For advanced use cases, the framework exposes internal modules:

| Subpath | Content |
|---------|---------|
| `mcp-server-framework/errors` | `ErrorCodes`, `HttpStatus`, error categories |
| `mcp-server-framework/logger` | `Logger` class, `configureLogger()` |
| `mcp-server-framework/config` | `getFrameworkConfig()`, env helpers |
| `mcp-server-framework/telemetry` | `withSpan()`, `MCP_ATTRIBUTES` |
| `mcp-server-framework/session` | `SessionManagerImpl`, `SessionStore` |
| `mcp-server-framework/http` | `createExpressApp()`, `startHttpTransport()` |

Only `mcp-server-framework/errors` is currently used in this project. The main export covers all other needs.

## Security by Design

- Validate all external inputs via Zod schemas
- Never log sensitive data (framework logger scrubs automatically)
- Credentials never in code or commits — use env vars or Docker secrets (`_FILE` pattern)
- Non-root container user in production

## Observability

Telemetry is opt-in via environment variables. The framework auto-instruments HTTP requests, sessions, and tool execution when enabled. No Komodo-specific code changes are needed.

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=komodo-mcp-server
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Code Organization

- Directory structure mirrors architecture (see `architecture.instructions.md`)
- Config aggregation: central config files with barrel export (`config/index.ts`)
- Constants: centralized in `config/descriptions.ts` — no magic strings
- JSDoc for public APIs and module headers

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case.ts` | `api-helpers.ts`, `response-formatter.ts` |
| Classes | `PascalCase` | `KomodoClient`, `OutputBuffer` |
| Interfaces | `PascalCase` | `KomodoCredentials`, `ActionResponseOptions` |
| Functions / Variables | `camelCase` | `requireClient`, `wrapApiCall` |
| Constants | `SCREAMING_SNAKE_CASE` | `PARAM_DESCRIPTIONS`, `RESPONSE_ICONS` |
| MCP Tools | `komodo_<domain>_<action>` | `komodo_container_start` |
| Types | `PascalCase` | `ActionType`, `ResourceType` |

## Git & Commits

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep changelog updated
- Never commit `.env` files
