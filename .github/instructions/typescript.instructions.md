---
applyTo: "**/*.ts"
description: TypeScript-specific coding standards
---

# TypeScript Guidelines

## Strict Mode

`strict: true` is enabled in `tsconfig.json`. All strict checks are active.

## Type Safety

- **No `any`** — use `unknown` with type guards instead
- If `any` is unavoidable: document why with a comment tag (e.g. `// @sdk-constraint`)
- Explicit return types for public functions
- Use `readonly` on interface properties for immutable data

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Interfaces | `PascalCase` | `KomodoCredentials`, `ActionResponseOptions` |
| Types | `PascalCase` | `ActionType`, `ResourceType` |
| Classes | `PascalCase` | `KomodoClient`, `OutputBuffer` |
| Functions / Variables | `camelCase` | `requireClient`, `wrapApiCall` |
| Constants | `SCREAMING_SNAKE_CASE` | `PARAM_DESCRIPTIONS`, `RESPONSE_ICONS` |

Interfaces do **not** use the `I`-prefix:

```typescript
// ✅ Correct
export interface KomodoCredentials { ... }
export interface ActionResponseOptions { ... }

// ❌ Not used in this project
export interface IKomodoCredentials { ... }
```

## Module System

- ES Modules (`"type": "module"` in `package.json`)
- `.js` extension in all imports (TypeScript resolves to `.ts` at build time)
- Barrel files (`index.ts`) for clean exports per module
- No circular dependencies

```typescript
// ✅ Correct import pattern
import { defineTool, text, z } from "mcp-server-framework";
import { requireClient, wrapApiCall } from "../utils/index.js";
import { PARAM_DESCRIPTIONS } from "../config/index.js";
```

## Zod Schemas

- All runtime validation uses Zod schemas
- Environment variables validated in `config/env.ts`
- Tool input schemas in `tools/schemas/`
- Import `z` from `mcp-server-framework` (guaranteed version compatibility)

```typescript
import { z } from "mcp-server-framework";

export const serverIdSchema = z.string().min(1);
```

## Async/Await

- `async/await` over Promise chains
- Use `AbortSignal` for cancellable operations
- Let errors propagate through `wrapApiCall()` — no defensive try/catch
