/**
 * Version Resolution
 *
 * Single Source of Truth: package.json
 *
 * Uses Node's `createRequire` to resolve package.json from the module's
 * location. Works in all execution contexts: src/, build/, Docker, npx.
 *
 * @module config/version
 */

import { createRequire } from "node:module";

/**
 * Resolve application version from package.json.
 *
 * @returns Semantic version string or `'unknown'` if resolution fails
 */
export function resolveVersion(): string {
  try {
    const require = createRequire(import.meta.url);
    const pkg = require("../../package.json") as { version?: string };
    if (pkg.version) return pkg.version;
  } catch {
    // package.json not resolvable
  }

  return "unknown";
}

/** Cached version — resolved once at module load */
export const APP_VERSION = resolveVersion();
