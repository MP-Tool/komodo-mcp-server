/**
 * Tool Scopes
 *
 * Three-tier RBAC scope strings attached to every tool via `requiredScopes`.
 * The MCP-Server-Framework filters tools/resources/prompts based on the
 * authenticated session's `AuthContext.permissions` using a subset check
 * (`hasAllRequiredScopes`).
 *
 * **Who gets which scope**: an authenticated session holds the tiers its Komodo user's
 * permissions cover (`deriveKomodoScopes` in `src/auth/komodo-identity.ts`); an anonymous
 * network caller — authentication switched off — holds `komodo:read` only. Komodo enforces
 * fine-grained permissions server-side; these scopes act as a coarse pre-screen.
 *
 * **Tier semantics** (lowest sufficient tier per tool):
 * - `komodo:read`     — read-only operations (list, info, inspect, logs, stats, health)
 * - `komodo:operate`  — lifecycle operations (`*_action` tools)
 * - `komodo:admin`    — destructive / structural changes (create, update, delete, prune, exec)
 *
 * Tier inclusion (admin > operate > read) is **not** enforced by the framework, which
 * compares scope strings literally. `deriveKomodoScopes` expresses it instead: a user
 * entitled to a tier is granted every tier below it as well.
 *
 * @module config/scopes
 */

export const ToolScopes = {
  READ: "komodo:read",
  OPERATE: "komodo:operate",
  ADMIN: "komodo:admin",
} as const;

export type ToolScope = (typeof ToolScopes)[keyof typeof ToolScopes];
