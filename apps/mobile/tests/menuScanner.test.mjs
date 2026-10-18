import assert from "node:assert/strict";
import process from "node:process";
import { afterEach, test } from "node:test";
import { scanMenu } from "../src/features/menu-lens/services/menuScanner.ts";
const originalFetch = globalThis.fetch;
const originalScan = process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
const originalMenu = process.env.EXPO_PUBLIC_MENU_SCAN_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const [key, value] of [
    ["EXPO_PUBLIC_FOOD_SCAN_URL", originalScan],
    ["EXPO_PUBLIC_MENU_SCAN_URL", originalMenu],
  ]) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test("derives the menu endpoint from the configured food server", async () => {
  delete process.env.EXPO_PUBLIC_MENU_SCAN_URL;
  process.env.EXPO_PUBLIC_FOOD_SCAN_URL = "http://192.0.2.1:3000/api/food-scan";
  const signal = new AbortController().signal;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "http://192.0.2.1:3000/api/menu-scan");
    assert.deepEqual(JSON.parse(options.body), { image: "sample" });
    assert.equal(options.signal, signal);
    return Response.json({ dishes: [] });
  };
  assert.deepEqual(await scanMenu("sample", signal), []);
});
test("missing setup, rate limits, invalid output, and cancellation are distinct", async () => {
  delete process.env.EXPO_PUBLIC_MENU_SCAN_URL;
  delete process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
  await assert.rejects(
    scanMenu("photo", new AbortController().signal),
    /sample menu/,
  );
  process.env.EXPO_PUBLIC_MENU_SCAN_URL = "http://localhost/api/menu-scan";
  globalThis.fetch = async () => new Response(null, { status: 429 });
  await assert.rejects(scanMenu("photo", new AbortController().signal), /busy/);
  globalThis.fetch = async () => Response.json({ dishes: [{}] });
  await assert.rejects(
    scanMenu("photo", new AbortController().signal),
    /Invalid menu dish/,
  );
  const controller = new AbortController();
  controller.abort();
  globalThis.fetch = async () => {
    throw controller.signal.reason;
  };
  await assert.rejects(scanMenu("photo", controller.signal), {
    name: "AbortError",
  });
});
