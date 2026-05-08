/**
 * Tool Scopes
 *
 * Three-tier RBAC scope strings attached to every tool via `requiredScopes`.
 * The MCP-Server-Framework filters tools/resources/prompts based on the
 * authenticated session's `AuthContext.permissions` using a subset check
 * (`hasAllRequiredScopes`).
 *
 * TODO: **Passive today**: Komodo does not yet ship OIDC. Until tokens carry
 * scopes, `auth.method === 'anonymous'` and the framework filter is a
 * no-op — all tools remain visible. Once Komodo OIDC ships, these scopes
 * become enforced automatically without any code changes.
 *
 * **Tier semantics** (lowest sufficient tier per tool):
 * - `komodo:read`     — read-only operations (list, info, inspect, logs, stats, health)
 * - `komodo:operate`  — lifecycle operations (`*_action` tools)
 * - `komodo:admin`    — destructive / structural changes (create, update, delete, prune, exec)
 *
 * Tier inclusion (admin > operate > read) is **not** enforced by the
 * framework — it must be expressed by the IdP (e.g. an `admin` user gets
 * all three scopes in the token), or by a future scope-expansion helper.
 *
 * @module config/scopes
 */

export const ToolScopes = {
  READ: "komodo:read",
  OPERATE: "komodo:operate",
  ADMIN: "komodo:admin",
} as const;

export type ToolScope = (typeof ToolScopes)[keyof typeof ToolScopes];
