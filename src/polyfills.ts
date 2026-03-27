/**
 * HOTFIX: localStorage Polyfill for Node.js
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  TEMPORARY FIX — Remove this file when upstream issue is resolved   │
 * │  Issue: .dev/1.3.0/mogh-auth-client-localstorage.md                 │
 * │  Affects: komodo_client ≥2.0.0 → mogh_auth_client ≥1.2.1            │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Problem:
 *   `mogh_auth_client/dist/tokens.js` executes an IIFE at module load
 *   that calls `localStorage.getItem()` unconditionally. This is a
 *   browser-only API. The import chain is:
 *
 *     komodo_client/dist/lib.js
 *       → export * as MoghAuth from "mogh_auth_client"
 *         → mogh_auth_client/dist/lib.js
 *           → export { LOGIN_TOKENS } from "./tokens.js"
 *             → IIFE: localStorage.getItem(...)  ← CRASH in Node.js
 *
 *   Node.js 22+ provides a `localStorage` global, but it requires
 *   the `--localstorage-file` flag to be functional. Without it, the
 *   object exists but methods are undefined — `getItem` is not a function.
 *
 * Impact on our code:
 *   - We do NOT use `MoghAuth` or `LOGIN_TOKENS` anywhere
 *   - The crash is triggered purely as a side-effect of importing `komodo_client`
 *   - This polyfill has ZERO effect on our application logic
 *
 * How to remove:
 *   1. Delete this file: `src/polyfills.ts`
 *   2. Remove the import in `src/index.ts`: `import "./polyfills.js";`
 *   3. Rebuild. If no localStorage error → upstream is fixed.
 *
 * @module polyfills
 */

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- localStorage exists in Node.js 22+ but has no methods without --localstorage-file
if (typeof globalThis.localStorage?.getItem !== "function") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  } as Storage;
}
