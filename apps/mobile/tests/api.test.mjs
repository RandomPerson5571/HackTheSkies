import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { apiEndpoint } from "../src/lib/api.ts";
const original = process.env.EXPO_PUBLIC_API_URL;
afterEach(() => {
  if (original === undefined) delete process.env.EXPO_PUBLIC_API_URL;
  else process.env.EXPO_PUBLIC_API_URL = original;
});
test("one Worker origin resolves all APIs while explicit endpoint overrides still work", () => {
  process.env.EXPO_PUBLIC_API_URL = "https://cibo-api.example.workers.dev/";
  for (const name of [
    "food-scan",
    "menu-scan",
    "food-recommendations",
    "quest-personalization",
  ])
    assert.equal(
      apiEndpoint(`/api/${name}`),
      `https://cibo-api.example.workers.dev/api/${name}`,
    );
  assert.equal(
    apiEndpoint("/api/food-scan", "https://other.example/scan"),
    "https://other.example/scan",
  );
  delete process.env.EXPO_PUBLIC_API_URL;
  assert.equal(apiEndpoint("/api/food-scan"), "");
});
