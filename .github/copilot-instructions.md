<--help Workspace-specific instructions for GitHub Copilot -->

# Komodo MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to interact with [Komodo Container Manager](https://komo.do) for Docker container management, server orchestration, stack lifecycle, and deployment operations.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | ^5.0.0 | Strict Mode, ES2022 target |
| Node.js | ≥20.0.0 | Runtime |
| `mcp-server-framework` | ^1.1.0 | MCP protocol layer, transports, logging, errors |
| `komodo_client` | — | Komodo API bindings (read/execute operations) |
| Zod | via framework | Runtime schema validation |
| Docker | node:22-alpine | Multi-stage production builds |

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
│   ├── classes.ts        # ApiError, ConnectionError, AuthenticationError
│   ├── factory.ts        # AppErrorFactory (extends FrameworkErrorFactory)
│   ├── messages.ts       # AppMessages registry + getAppMessage()
│   └── extraction.ts     # Error parsing from komodo_client responses
├── tools/
│   ├── index.ts          # Side-effect imports (auto-registration)
│   ├── config.ts         # komodo_health_check
│   ├── container.ts      # Container operations (10 tools)
│   ├── server.ts         # Server operations (6 tools)
│   ├── stack.ts          # Stack lifecycle (13 tools)
│   ├── deployment.ts     # Deployment operations (13 tools)
│   ├── terminal.ts       # Terminal exec (4 tools)
│   ├── user.ts           # User metadata (3 tools)
│   └── schemas/          # Shared Zod schemas per domain
└── utils/
    ├── index.ts           # Barrel export
    ├── api-helpers.ts     # requireClient(), wrapApiCall(), checkCancelled()
    ├── response-formatter.ts  # formatActionResponse(), formatListHeader()
    ├── resource-link.ts   # tryRegisterResource() — registers payload in DynamicResourceRegistry, returns ResourceLinkSpec | null
    ├── markdown.ts        # Domain-specific Markdown renderers (containers, servers, stacks, deployments)
    ├── polling.ts         # wrapExecuteAndPoll() for long-running operations
    └── polyfills.ts       # Node.js polyfills for komodo_client
```

## Key Patterns

### Framework Dependency

All MCP infrastructure comes from `mcp-server-framework`:

```typescript
import { createServer, defineTool, text, z, logger } from "mcp-server-framework";
```

This project provides only Komodo-specific logic: API client, tool definitions, error classes, and configuration.

### Tool Definition

Tools use `defineTool()` with auto-registration via side-effect imports:

```typescript
import { defineTool, text, z } from "mcp-server-framework";
import { requireClient, wrapApiCall } from "../utils/index.js";

defineTool({
  name: "komodo_container_start",
  description: "Start a stopped container",
  input: z.object({ server: z.string(), container: z.string() }),
  annotations: { readOnlyHint: false, destructiveHint: false },
  handler: async (args, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      "startContainer",
      () => komodo.client.execute("StartContainer", { server: args.server, container: args.container }),
      abortSignal,
    );
    return text(formatActionResponse({ ... }));
  },
});
```

### Structured + Resource Link Response

Inspect/info/logs tools return `structured()` with an optional dynamic resource link for out-of-band retrieval:

```typescript
import { defineTool, structured, z } from "mcp-server-framework";
import { tryRegisterResource } from "../utils/index.js";

defineTool({
  name: "komodo_container_inspect",
  handler: async (args, { abortSignal, sessionId }) => {
    const komodo = requireClient();
    const data = await wrapApiCall("inspect", () => komodo.client.read(...), abortSignal);
    const link = tryRegisterResource({
      sessionId,
      category: "container-inspect",
      content: JSON.stringify(data, null, 2),
      mimeType: "application/json",
      name: `Inspect: ${args.container}`,
    });
    return structured(data, {
      text: renderContainerInspect(data),
      ...(link && { links: [link] }),
    });
  },
});
```
```

### Error Handling

Centralized error creation via `AppErrorFactory`:

```typescript
import { AppErrorFactory } from "../errors/index.js";

throw AppErrorFactory.notFound.server("my-server");
throw AppErrorFactory.api.requestFailed("timeout exceeded");
throw AppErrorFactory.auth.invalidCredentials();
```

Messages via `getAppMessage()` with interpolation:

```typescript
import { getAppMessage } from "../errors/index.js";
getAppMessage("API_REQUEST_FAILED_REASON", { reason: "timeout" });
```

### API Call Wrapping

All Komodo API calls go through `wrapApiCall()`:

```typescript
const result = await wrapApiCall("listContainers", () => komodo.client.read(...), abortSignal);
```

### Barrel Files

Every directory exports through `index.ts`. Import from barrel files, not individual modules:

```typescript
// ✅ Correct
import { requireClient, wrapApiCall } from "../utils/index.js";
// ❌ Don't import directly
import { requireClient } from "../utils/api-helpers.js";
```

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case.ts` | `api-helpers.ts`, `response-formatter.ts` |
| Classes | `PascalCase` | `KomodoClient`, `OutputBuffer` |
| Interfaces | `PascalCase` (no `I`-prefix) | `KomodoCredentials`, `ActionResponseOptions` |
| Functions / Variables | `camelCase` | `requireClient`, `wrapApiCall` |
| Constants | `SCREAMING_SNAKE_CASE` | `PARAM_DESCRIPTIONS`, `RESPONSE_ICONS` |
| MCP Tools | `komodo_<domain>_<action>` | `komodo_container_start` |

## 70 MCP Tools

Namenskonvention: `komodo_<domain>_<action>`. Lifecycle-Operationen mit ≥4 Verben sind als `*_action`-Tools mit Discriminator konsolidiert. CRUD-Operationen (`create` + `update`) sind als `*_apply`-Tools mit `action`-Discriminator konsolidiert (Terraform/kubectl-Idiom). Sowohl `*_action` als auch `*_apply` nutzen ein flaches `z.object({ action: z.enum([...]), ...optional })`-Schema (kein `z.discriminatedUnion`), da viele MCP-Clients (inkl. MCP Inspector) Discriminated Unions als Input nicht rendern können — Pflichtfelder pro Branch werden zur Laufzeit via `AppErrorFactory.validation.fieldRequired()` validiert.

| Category | Count | Tools |
|----------|-------|-------|
| Config | 1 | `komodo_health_check` |
| Container | 5 | `*_list`, `*_inspect`¹, `*_logs`¹, `*_search_logs`¹, `*_action` (start/stop/restart/pause/unpause) |
| Server | 6 | `*_list`, `*_info`¹, `*_stats`, `*_apply` (create/update), `*_delete`, `*_action` (start_all/restart_all/pause_all/unpause_all/stop_all/prune_*/delete_*) |
| Stack | 5 | `*_list`, `*_info`¹, `*_apply` (create/update), `*_delete`, `*_action` (deploy/pull/start/restart/pause/unpause/stop/destroy) |
| Deployment | 5 | `*_list`, `*_info`¹, `*_apply` (create/update), `*_delete`, `*_action` (deploy/pull/start/restart/pause/unpause/stop/destroy) |
| Build | 6 | `*_list`, `*_info`¹, `*_action` (run/cancel), `*_logs`¹, `*_apply` (create/update), `*_delete` |
| Repo | 5 | `*_list`, `*_info`¹, `*_action` (clone/pull/build/cancel_build), `*_apply` (create/update), `*_delete` |
| Procedure | 5 | `*_list`, `*_info`¹, `*_action` (run), `*_apply` (create/update), `*_delete` |
| Action | 5 | `*_list`, `*_info`¹, `*_action` (run/cancel), `*_apply` (create/update), `*_delete` |
| Alerter | 4 | `*_list`, `*_info`¹, `*_apply` (create/update), `*_delete` |
| Swarm | 7 | `*_list`, `*_info`¹, `*_apply` (create/update), `*_delete`, `*_nodes_list`, `*_services_list`, `*_action` (update_node/remove_nodes/remove_services/remove_stacks) |
| Terminal | 1 | `komodo_exec` (discriminated union: server / container / deployment / stack_service) |
| User | 3 | `*_list_api_keys`, `*_create_api_key`, `*_delete_api_key` |
| Variable | 4 | `*_list`, `*_info`, `*_apply` (create/update — dispatches to UpdateVariableValue/Description/IsSecret), `*_delete` |
| ResourceSync | 5 | `*_list`, `*_info`¹, `*_action` (run/refresh), `*_apply` (create/update), `*_delete` |
| Update | 2 | `*_list` (filterable by operation/target, page-encoded cursor), `*_info`¹ |

¹ Returns `structured()` with `structuredContent` + Markdown text + optional `ephemeral://` resource link via `tryRegisterResource()` (set `inline_full: true` to bypass).

List/info/logs tools support **cursor pagination** via `{ cursor, page_size }` (1–100, default 50) and emit `_meta.page.next_cursor` when more items are available.

Jedes Tool trägt `_meta.category` (siehe `config/categories.ts`, 16 Kategorien) und `requiredScopes` (siehe `config/scopes.ts`, Drei-Tier-RBAC: `komodo:read` / `komodo:operate` / `komodo:admin`).

## Security

- Validate all inputs via Zod schemas
- Credentials via environment variables or Docker secrets (`_FILE` pattern)
- Never log sensitive data (framework logger scrubs automatically)
- Non-root Docker user in production

## Observability

OpenTelemetry is opt-in via environment variables. The framework auto-instruments HTTP requests, sessions, and tool execution — no Komodo-specific telemetry code needed.

```bash
OTEL_ENABLED=true
OTEL_SERVICE_NAME=komodo-mcp-server
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
```

## Build & Run

```bash
npm run build         # Compile TypeScript
npm run build:prod    # Production build
npm run dev           # Build + start
npm run start         # Run compiled code
npm run lint          # ESLint
npm run format        # Prettier
```

## Git Conventions

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`
- Keep CHANGELOG.md updated
- Never commit `.env` files
