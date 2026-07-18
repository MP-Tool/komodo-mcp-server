import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVersion, compareVersions, isVersionGreater, requireMinimalVersion } from "./version.js";

// --- parseVersion ------------------------------------------------------------

test("parseVersion parses major.minor.patch", () => {
  assert.deepEqual(parseVersion("1.19.5"), { major: 1, minor: 19, patch: 5 });
  assert.deepEqual(parseVersion("2.1.0"), { major: 2, minor: 1, patch: 0 });
});

test("parseVersion ignores a leading 'v' and a pre-release/build suffix", () => {
  assert.deepEqual(parseVersion("v2.0.0-dev102"), { major: 2, minor: 0, patch: 0 });
  assert.deepEqual(parseVersion("2.3.1+build.7"), { major: 2, minor: 3, patch: 1 });
});

test("parseVersion defaults omitted minor/patch to 0", () => {
  assert.deepEqual(parseVersion("2"), { major: 2, minor: 0, patch: 0 });
  assert.deepEqual(parseVersion("2.4"), { major: 2, minor: 4, patch: 0 });
});

test("parseVersion returns null for a non-numeric leading string", () => {
  assert.equal(parseVersion("nightly"), null);
  assert.equal(parseVersion("-dev102"), null);
  assert.equal(parseVersion(""), null);
});

// --- compareVersions ---------------------------------------------------------

test("compareVersions orders by major, then minor, then patch", () => {
  assert.ok(compareVersions({ major: 2, minor: 0, patch: 0 }, { major: 1, minor: 19, patch: 5 }) > 0);
  assert.ok(compareVersions({ major: 2, minor: 1, patch: 0 }, { major: 2, minor: 0, patch: 9 }) > 0);
  assert.ok(compareVersions({ major: 2, minor: 0, patch: 1 }, { major: 2, minor: 0, patch: 2 }) < 0);
  assert.equal(compareVersions({ major: 2, minor: 0, patch: 0 }, { major: 2, minor: 0, patch: 0 }), 0);
});

// --- isVersionGreater --------------------------------------------------------

test("isVersionGreater compares over major.minor.patch", () => {
  assert.equal(isVersionGreater("2.0.0", "1.19.5"), true);
  assert.equal(isVersionGreater("2.0.1", "2.0.0"), true);
  assert.equal(isVersionGreater("2.0.0", "2.0.0"), false);
  assert.equal(isVersionGreater("1.19.5", "2.0.0"), false);
});

test("isVersionGreater ignores suffixes and honors partial precision", () => {
  assert.equal(isVersionGreater("2.0.0", "2.0.0-dev102"), false); // suffix ignored → equal
  assert.equal(isVersionGreater("2.1", "2.0.9"), true); // 2.1.0 > 2.0.9
});

test("isVersionGreater returns false when either side is unparseable", () => {
  assert.equal(isVersionGreater("2.0.0", "nightly"), false);
  assert.equal(isVersionGreater("weird", "1.0.0"), false);
});

// --- requireMinimalVersion ---------------------------------------------------

test("requireMinimalVersion throws when the core is too old, naming the reported version", () => {
  assert.throws(
    () => requireMinimalVersion("1.19.5", "2.0.0", "komodo_exec"),
    (err: Error) => /komodo_exec requires Komodo core >= 2\.0\.0/.test(err.message) && err.message.includes("1.19.5"),
  );
});

test("requireMinimalVersion passes when the core meets the minimum", () => {
  assert.doesNotThrow(() => requireMinimalVersion("2.0.1", "2.0.0", "komodo_exec"));
  assert.doesNotThrow(() => requireMinimalVersion("2.1.0", "2.0.0", "komodo_exec"));
  assert.doesNotThrow(() => requireMinimalVersion("5.11.3", "2.0.0", "komodo_exec"));
});

test("requireMinimalVersion passes on an exact match", () => {
  assert.doesNotThrow(() => requireMinimalVersion("2.0.0", "2.0.0", "komodo_exec"));
  assert.doesNotThrow(() => requireMinimalVersion("2.1.0", "2.1.0", "komodo_exec"));
  assert.doesNotThrow(() => requireMinimalVersion("2.1.123", "2.1.123", "komodo_exec"));
});

test("requireMinimalVersion honors a patch-level minimum", () => {
  assert.throws(() => requireMinimalVersion("2.3.0", "2.3.1", "some feature"));
  assert.doesNotThrow(() => requireMinimalVersion("2.3.1", "2.3.1", "some feature"));
});

test("requireMinimalVersion does not block an unparseable core version", () => {
  assert.doesNotThrow(() => requireMinimalVersion("custom-build", "2.0.0", "komodo_exec"));
});
