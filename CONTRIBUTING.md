# Contributing to Komodo MCP Server

Contributions are welcome — bug reports, feature ideas, documentation improvements, and code. Be respectful, inclusive, and constructive.

## Getting Started

```bash
git clone https://github.com/MP-Tool/komodo-mcp-server.git
cd komodo-mcp-server
npm install
npm run build
```

**Prerequisites**: Node.js 22+, Docker (for container testing), a Komodo v2 instance for testing tools.

## Project Structure

```
src/
├── index.ts              # Server entry point (createServer + tool imports)
├── client.ts             # Komodo API client (connection management)
├── config/               # Configuration & environment validation (Zod)
│   ├── env.ts            # Environment variable schema
│   ├── tools.config.ts   # Tool parameter defaults
│   └── descriptions.ts   # Shared parameter descriptions
├── tools/                # MCP tool definitions (via defineTool())
│   └── schemas/          # Shared Zod schemas for tool inputs
├── errors/               # Application-specific error classes & factory
└── utils/                # Helpers (API wrappers, polling, response formatting)
```

Built on [mcp-server-framework](https://github.com/MP-Tool/mcp-server-framework).

## Coding Standards

### TypeScript

- **Strict mode** enabled — no `any` types (use `unknown` + type guards)
- **Zod** for all runtime validation (tool inputs, env vars, config)
- **ES Modules** with `.js` extensions in imports
- Barrel files (`index.ts`) for clean module exports

### Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | `kebab-case.ts` | `container-start.ts` |
| Classes | `PascalCase` | `ConnectionStateManager` |
| Interfaces | `IPascalCase` | `IApiClient` |
| Functions / Variables | `camelCase` | `requireClient` |
| Constants | `SCREAMING_SNAKE_CASE` | `PARAM_DESCRIPTIONS` |
| Private Members | `_camelCase` | `_connection` |
| MCP Tools | `komodo_<domain>_<action>` | `komodo_container_start` |

### Error Handling

Use `AppErrorFactory` for application errors, `wrapApiCall()` for Komodo API calls:

```typescript
import { AppErrorFactory } from '../errors/index.js';

throw AppErrorFactory.notFound.server('my-server');
throw AppErrorFactory.api.requestFailed('timeout exceeded');

// API calls — handles errors, metrics, and tracing automatically
const result = await wrapApiCall(
  'listContainers',
  () => komodo.read('ListContainers', { server }),
  abortSignal,
);
```

### Adding a Tool

Each tool is a separate file in `src/tools/<category>/`. Use `defineTool()` with Zod schemas and shared `PARAM_DESCRIPTIONS`:

```typescript
import { defineTool, text, z } from 'mcp-server-framework';
import { PARAM_DESCRIPTIONS } from '../../config/index.js';
import { requireClient, wrapApiCall } from '../../utils/index.js';

export const myTool = defineTool({
  name: 'komodo_category_action',
  description: 'Clear description of what the tool does',
  input: z.object({
    server: z.string().describe(PARAM_DESCRIPTIONS.SERVER_ID),
  }),
  annotations: { readOnlyHint: true },
  handler: async ({ input: args }, { abortSignal }) => {
    const komodo = requireClient();
    const result = await wrapApiCall(
      'getServer',
      () => komodo.read('GetServer', { server: args.server }),
      abortSignal,
    );
    return text(JSON.stringify(result));
  },
});
```

Import the tool file in `src/index.ts` — it auto-registers via the global registry.

## Commits & Pull Requests

### Conventional Commits

```
feat: add deployment monitoring tool
fix: resolve container restart timeout
docs: update Docker installation guide
refactor: extract polling logic into utility
chore: update dependencies
```

### Pull Request Checklist

- [ ] Code builds (`npm run build`)
- [ ] Docker image builds (`npm run docker:build`)
- [ ] Changes fully tested locally
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention

PRs go against the upcoming release branch, or `main` if no release branch exists. Automated CI runs build, CodeQL, dependency review, and Docker build checks.

Keep PRs focused and small for easier review. For larger features, consider opening an issue/feature request first to discuss the design before implementation.

## Reporting Issues

- **Bugs**: [Open an issue](https://github.com/MP-Tool/komodo-mcp-server/issues) with steps to reproduce, expected vs actual behavior, and your environment (OS, Node, Docker, Komodo version).
- **Features**: Describe the problem, your proposed solution, and a real-world use case.
- **Security**: See [SECURITY.md](SECURITY.md) for responsible disclosure.

## Need Help?

- [README](README.md) — Project overview and quick start
- [Configuration Guide](config/README.md) — All env vars, config files, Docker secrets
- [Discussions](https://github.com/MP-Tool/komodo-mcp-server/discussions) — Questions and ideas
