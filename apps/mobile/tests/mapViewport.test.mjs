import assert from "node:assert/strict";
import test from "node:test";
import { mapViewportKey, loadViewportPages } from "../src/lib/mapViewport.ts";

test("crossing the details threshold always changes the viewport key", () => {
  const bounds = [-80, 43, -79, 44];
  assert.notEqual(mapViewportKey(bounds, 11.99), mapViewportKey(bounds, 12.01));
  assert.notEqual(mapViewportKey(bounds, 12), mapViewportKey([-80, 43, -78.9999, 44], 12));
});

test("viewport includes filter matches beyond the first 400 restaurants", async () => {
  const catalog = Array.from({ length: 805 }, (_, i) => ({
    id: String(i).padStart(4, "0"), matches: i === 804,
  }));
  const result = await loadViewportPages(async (afterId, limit) =>
    catalog.filter((row) => afterId === undefined || row.id > afterId).slice(0, limit),
  () => false);
  assert.equal(result.length, 805);
  assert.deepEqual(result.filter((row) => row.matches), [catalog[804]]);
});

test("superseded viewport requests stop fetching pages", async () => {
  let stale = false;
  let calls = 0;
  const result = await loadViewportPages(async () => {
    calls++;
    stale = true;
    return Array.from({ length: 400 }, (_, i) => ({ id: String(i) }));
  }, () => stale);
  assert.equal(calls, 1);
  assert.deepEqual(result, []);
});
