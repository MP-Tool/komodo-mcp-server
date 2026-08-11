/**
 * Komodo core version compatibility.
 *
 * Some tools use Komodo APIs that only exist from a certain Komodo version on
 * (e.g. the unified terminal/exec request body and the Docker Swarm resources,
 * both Komodo 2.0+). Calling them against an older core fails with a cryptic
 * deserialization error. {@link requireMinimalVersion} compares the core version
 * (which the caller reads) against a minimum and fails fast with an actionable
 * message.
 *
 * Pure and client-agnostic: comparison is semver-style over `major.minor.patch`;
 * any leading `v` and any pre-release/build suffix (e.g. `-dev102`) are ignored,
 * and an unparseable version never blocks a call.
 *
 * @module utils/version
 */

import { AppErrorFactory } from "../errors/index.js";

/** A parsed `major.minor.patch` version. Missing components default to `0`. */
export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
}

/**
 * The Komodo version that unified the terminal/exec request body and introduced
 * the Docker Swarm resources. Cores older than this reject both with a cryptic
 * deserialization error, so the tools that use them require at least this version.
 */
export const KOMODO_MINIMAL_API_VERSION = "2.0.0";

/**
 * Parse a version string into `major.minor.patch`. A leading `v` and any
 * trailing pre-release/build suffix (`-dev102`, `+build`, …) are ignored;
 * omitted minor/patch default to `0`. Returns `null` when there's no leading
 * numeric major (so an unrecognised format never blocks a call).
 *
 * @example parseVersion("1.19.5")       // { major: 1, minor: 19, patch: 5 }
 * @example parseVersion("v2.0.0-dev102") // { major: 2, minor: 0, patch: 0 }
 * @example parseVersion("2.1")          // { major: 2, minor: 1, patch: 0 }
 * @example parseVersion("nightly")      // null
 */
export function parseVersion(raw: string): Version | null {
  const match = /^\d[\d.]*/.exec(raw.trim().replace(/^v/i, ""));
  if (!match) return null;
  const [major = 0, minor = 0, patch = 0] = match[0].split(".").map((part) => Number(part) || 0);
  return { major, minor, patch };
}

/**
 * Compare two parsed versions over `major`, then `minor`, then `patch`.
 * Returns a negative number if `a < b`, `0` if equal, a positive number if `a > b`.
 */
export function compareVersions(a: Version, b: Version): number {
  return a.major - b.major || a.minor - b.minor || a.patch - b.patch;
}

/**
 * Whether version `a` is strictly greater than version `b` (over
 * `major.minor.patch`). Either side that can't be parsed yields `false`, so an
 * unrecognised version is never treated as newer or older.
 */
export function isVersionGreater(a: string, b: string): boolean {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) return false;
  return compareVersions(pa, pb) > 0;
}

// ============================================================================
// Guard
// ============================================================================

/**
 * Fail fast when the connected Komodo core is older than `minimum`.
 *
 * Throws an actionable error when `minimum` is strictly greater than `current`
 * (over `major.minor.patch`). The `minimum` may be given at any precision —
 * `"2"`, `"2.1"`, `"2.1.3"` — and an unparseable `current` never blocks (a
 * future/exotic format is tolerated). The caller reads the core version.
 *
 * @param current The core version reported by the connected server.
 * @param minimum Minimum acceptable core version (`major[.minor[.patch]]`).
 * @param feature Human-readable feature name for the error message.
 */
export function requireMinimalVersion(current: string, minimum: string, feature: string): void {
  if (isVersionGreater(minimum, current)) {
    throw AppErrorFactory.api.custom(
      `${feature} requires Komodo core >= ${minimum}, but the connected core reports ${current}. ` +
        `Please upgrade your Komodo core to use this feature.`,
    );
  }
}
