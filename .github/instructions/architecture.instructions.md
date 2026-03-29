---
applyTo: "**"
description: Project architecture and module structure for Komodo MCP Server
---

# Architecture

## Overview

Komodo MCP Server is a consumer of the `mcp-server-framework` package. The framework provides the MCP protocol layer (transports, sessions, logging, error system, telemetry). This project provides the Komodo-specific implementation: API client, tool definitions, error classes, and configuration.

## Project Structure

```
src/
├── index.ts              # Entry point — createServer() + lifecycle hooks
├── client.ts             # KomodoClient wrapper + connection monitoring
├── config/
│   ├── index.ts          # Barrel export
│   ├── env.ts            # Zod schema for env vars + config file section
│   ├── descriptions.ts   # PARAM_DESCRIPTIONS, RESPONSE_ICONS, constants
│   ├── version.ts        # SERVER_NAME, SERVER_VERSION
│   └── tools.config.ts   # Tool-specific defaults (log tails, timeouts)
├── errors/
│   ├── index.ts          # Barrel export
│   ├── classes.ts        # ApiError, ConnectionError, AuthenticationError, etc.
│   ├── factory.ts        # AppErrorFactory (extends FrameworkErrorFactory)
│   ├── messages.ts       # AppMessages registry + getAppMessage()
│   └── extraction.ts     # Error parsing from komodo_client responses
├── tools/
│   ├── index.ts          # Side-effect imports (auto-registration)
│   ├── config.ts         # komodo_configure, komodo_health_check
│   ├── container.ts      # Container operations (list, inspect, start, stop, ...)
│   ├── server.ts         # Server operations (list, stats, create, ...)
│   ├── stack.ts          # Stack lifecycle (list, deploy, start, stop, ...)
│   ├── deployment.ts     # Deployment operations (list, deploy, create, ...)
│   ├── terminal.ts       # Terminal exec (server, container, deployment, stack)
│   ├── user.ts           # User metadata, health check
│   └── schemas/          # Shared Zod schemas per domain
│       ├── index.ts      # Barrel export
│       ├── container.ts
│       ├── server.ts
│       ├── deployment.ts
│       ├── stack.ts
│       └── validators.ts # Shared schema helpers
└── utils/
    ├── index.ts           # Barrel export
    ├── api-helpers.ts     # requireClient(), wrapApiCall(), checkCancelled()
    ├── response-formatter.ts  # formatActionResponse(), formatListHeader(), ...
    ├── polling.ts         # wrapExecuteAndPoll() for long-running operations
    └── polyfills.ts       # Node.js polyfills for komodo_client
```

## Layers

```
Entry Point (index.ts)
  └─ createServer() from mcp-server-framework
       ├─ Config (config/) — env vars, descriptions, defaults
       ├─ Tools (tools/) — defineTool() with auto-registration
       │    └─ Utils (utils/) — requireClient(), wrapApiCall(), formatters
       │         └─ API Client (client.ts) — KomodoClient wrapping komodo_client
       └─ Errors (errors/) — AppErrorFactory, AppMessages, error classes
```

## Framework Dependency

The `mcp-server-framework` package provides:

| What | Import |
|------|--------|
| Server creation | `createServer` |
| Tool definition | `defineTool`, `text`, `json`, `error` |
| Schema validation | `z` (re-exported Zod) |
| Duration parsing | `durationSchema`, `parseDuration` |
| Config integration | `registerConfigSection`, `getAppConfig` |
| Logging | `logger` |
| Error base classes | `FrameworkErrorFactory`, `AppError`, `OperationCancelledError` |
| Message interpolation | `interpolate` |

All framework features are imported from `mcp-server-framework` — no deep imports into framework internals.

## Barrel Files

Every directory exports through `index.ts`:
- Re-exports all public APIs of the module
- Internal files are not imported directly from outside the module
- One clean public interface per module

## Tool Registration

Tools are registered via module side-effects:

```typescript
// tools/index.ts — importing registers all tools in the global registry
import "./config.js";
import "./container.js";
import "./server.js";
// ...

// index.ts — side-effect import triggers registration before createServer()
import "./tools/index.js";
```

Each tool file calls `defineTool()` at module scope, which auto-registers the tool in the framework's global tool registry.

## Connection Management

`KomodoClient` in `client.ts` wraps the `komodo_client` package:
- Static factory methods: `login()`, `connectWithApiKey()`, `connectWithJwt()`
- Connection monitoring via `KomodoConnectionMonitor` (periodic health checks)
- `requireClient()` in `utils/api-helpers.ts` provides access to the singleton client
- Readiness check integrated into `createServer({ health: { readinessCheck } })`
