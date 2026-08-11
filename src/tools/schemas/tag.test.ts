import "../../utils/polyfills.js"; // must be first — localStorage polyfill for komodo_client's import chain
import { test } from "node:test";
import assert from "node:assert/strict";
import { Types } from "komodo_client";
import { parseTagColor, TAG_COLOR_VALUES } from "./tag.js";

test("parseTagColor accepts a valid color name and returns the TagColor", () => {
  assert.equal(parseTagColor("Blue"), Types.TagColor.Blue);
  assert.equal(parseTagColor("DarkRed"), Types.TagColor.DarkRed);
  assert.equal(parseTagColor("LightGreen"), Types.TagColor.LightGreen);
});

test("parseTagColor rejects unknown or mis-cased input (case-sensitive)", () => {
  assert.equal(parseTagColor("blue"), null);
  assert.equal(parseTagColor("Turquoise"), null);
  assert.equal(parseTagColor(""), null);
  assert.equal(parseTagColor("#0000ff"), null);
});

test("TAG_COLOR_VALUES covers the full TagColor enum", () => {
  assert.equal(TAG_COLOR_VALUES.length, Object.values(Types.TagColor).length);
  assert.ok(TAG_COLOR_VALUES.includes("Slate"));
  assert.ok(TAG_COLOR_VALUES.includes("DarkRose"));
});
