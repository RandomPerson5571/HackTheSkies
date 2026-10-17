import assert from "node:assert/strict";
import process from "node:process";
import { afterEach, test } from "node:test";
import { recognizeFood } from "../src/features/food-dex/services/foodScanner.ts";

const originalFetch = globalThis.fetch;
const originalEndpoint = process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalEndpoint === undefined)
    delete process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
  else process.env.EXPO_PUBLIC_FOOD_SCAN_URL = originalEndpoint;
});

test("an unreachable API explains how to restore photo recognition", async () => {
  process.env.EXPO_PUBLIC_FOOD_SCAN_URL = "http://localhost:3000/api/food-scan";
  globalThis.fetch = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(
    recognizeFood("photo", new AbortController().signal),
    /Check your connection and the recognition server address/,
  );
});

test("cancellation stays distinguishable from connection failures", async () => {
  process.env.EXPO_PUBLIC_FOOD_SCAN_URL = "http://localhost:3000/api/food-scan";
  const controller = new AbortController();
  controller.abort();
  const error = new DOMException("Aborted", "AbortError");
  globalThis.fetch = async () => {
    throw error;
  };
  await assert.rejects(recognizeFood("photo", controller.signal), error);
});

test("rate limits tell the user to wait before retrying", async () => {
  process.env.EXPO_PUBLIC_FOOD_SCAN_URL = "http://localhost:3000/api/food-scan";
  globalThis.fetch = async () => new Response(null, { status: 429 });
  await assert.rejects(
    recognizeFood("photo", new AbortController().signal),
    /Wait a moment and retry/,
  );
});

test("a successful scan preserves the server's canonical catalog match", async () => {
  process.env.EXPO_PUBLIC_FOOD_SCAN_URL = "http://localhost:3000/api/food-scan";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, process.env.EXPO_PUBLIC_FOOD_SCAN_URL);
    assert.deepEqual(JSON.parse(options.body), { image: "photo" });
    return Response.json({
      name: "Spanakopita",
      cuisine: "Greek",
      catalogId: "spanakopita",
    });
  };
  assert.deepEqual(await recognizeFood("photo", new AbortController().signal), {
    name: "Spanakopita",
    cuisine: "Greek",
    catalogId: "spanakopita",
  });
});
