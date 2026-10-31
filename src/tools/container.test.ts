// The Komodo SDK imports mogh_auth_client, which requires localStorage.
import "../utils/polyfills.js";

import { test } from "node:test";
import assert from "node:assert/strict";
import type { Types } from "komodo_client";
import { summarizeContainerListItem } from "./container.js";
import { containerSummarySchema } from "./schemas/container.js";
import { renderContainerList } from "../utils/markdown.js";

const withStats = {
  name: "training-worker",
  state: "running",
  image: "example/worker:1.0",
  stats: {
    name: "training-worker",
    cpu_perc: "12.5%",
    mem_perc: "25.0%",
    mem_usage: "256MiB / 1GiB",
    net_io: "1.2MB / 3.4MB",
    block_io: "10MB / 20MB",
    pids: "7",
  },
} as Types.ContainerListItem;

test("#201 returns every collected container stats field unchanged", () => {
  const item = summarizeContainerListItem(withStats);
  assert.deepEqual(item.stats, withStats.stats);
  const parsed = containerSummarySchema.parse(item);
  const stats = parsed.stats;
  assert.ok(stats);
  assert.deepEqual(stats, withStats.stats);
  assert.equal(stats.cpu_perc, "12.5%");
  assert.equal(stats.mem_usage, "256MiB / 1GiB");
  assert.equal(stats.net_io, "1.2MB / 3.4MB");
  assert.equal(stats.block_io, "10MB / 20MB");
  assert.equal(stats.pids, "7");
});

test("#201 keeps stats optional for stopped containers and absent polls", () => {
  const stopped = {
    name: "stopped-worker",
    state: "exited",
    image: "example/worker:1.0",
  } as Types.ContainerListItem;
  const summary = summarizeContainerListItem(stopped);
  assert.equal("stats" in summary, false);
  assert.equal(containerSummarySchema.parse(summary).stats, undefined);
  const text = renderContainerList({ items: [summary] });
  assert.match(text, /stopped-worker/);
  assert.doesNotMatch(text, /CPU:/);
});

test("#201 renders CPU, memory, network, block I/O and PIDs in Markdown", () => {
  const text = renderContainerList({ items: [summarizeContainerListItem(withStats)] });
  for (const value of ["12.5%", "25.0%", "256MiB / 1GiB", "1.2MB / 3.4MB", "10MB / 20MB", "PIDs: 7"]) {
    assert.ok(text.includes(value), "Missing stats value " + value);
  }
});

test("#201 rejects invalid non-string stats to avoid silently dropping malformed data", () => {
  const bad = { ...withStats, stats: { ...withStats.stats, cpu_perc: 12.5 } };
  assert.equal(containerSummarySchema.safeParse(bad).success, false);
});
