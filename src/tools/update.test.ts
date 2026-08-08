// Must precede any komodo_client import — mogh_auth_client touches localStorage at load.
import "../utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeUpdateCursor, decodeUpdateCursor } from "./update.js";

// ============================================================================
// Update-log cursor.
//
// komodo_update_list bridges two pagination models: Komodo serves fixed pages of
// 100 (UPDATES_PER_PAGE in Core), the tool hands out `page_size` items. The cursor
// must carry BOTH coordinates. Encoding only the page number skipped the rest of
// each page — with page_size=25 that lost 75 of every 100 audit entries.
// ============================================================================

test("cursor round-trips page and offset", () => {
  for (const [page, offset] of [
    [0, 0],
    [0, 25],
    [3, 75],
    [12, 99],
  ] as const) {
    assert.deepEqual(decodeUpdateCursor(encodeUpdateCursor(page, offset)), { page, offset });
  }
});

test("an absent cursor starts at the beginning", () => {
  assert.deepEqual(decodeUpdateCursor(undefined), { page: 0, offset: 0 });
});

test("a bare page number is still accepted (cursor held across an upgrade)", () => {
  // The pre-fix format was the plain page index. Such a cursor must keep working
  // rather than throwing — it resumes at the start of that Komodo page.
  assert.deepEqual(decodeUpdateCursor("0"), { page: 0, offset: 0 });
  assert.deepEqual(decodeUpdateCursor("4"), { page: 4, offset: 0 });
});

test("malformed cursors fall back to the first page instead of failing", () => {
  for (const bad of ["", "not-base64!!", "-1", "1.5", Buffer.from("x:y").toString("base64")]) {
    assert.deepEqual(decodeUpdateCursor(bad), { page: 0, offset: 0 }, `input: ${JSON.stringify(bad)}`);
  }
});

test("negative coordinates are rejected, not propagated into a query", () => {
  assert.deepEqual(decodeUpdateCursor(encodeUpdateCursor(-1, 0)), { page: 0, offset: 0 });
  assert.deepEqual(decodeUpdateCursor(encodeUpdateCursor(0, -5)), { page: 0, offset: 0 });
});

test("the cursor is opaque — not a readable page number", () => {
  // Guards against a caller inferring and hand-crafting the format.
  assert.notEqual(encodeUpdateCursor(3, 75), "3");
});
