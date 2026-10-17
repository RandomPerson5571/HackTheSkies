import process from "node:process";
import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { POST, OPTIONS } from "../routes/food-recommendations.ts";
import restaurants from "../../src/features/restaurants/data/importedRestaurants.json" with { type: "json" };
const originalFetch = globalThis.fetch;
const originalKey = process.env.GROQ_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
});
const request = (value) =>
  new Request("http://localhost/api/food-recommendations", {
    method: "POST",
    body: JSON.stringify(value),
  });
test("missing configuration and invalid requests fail before calling Groq", async () => {
  delete process.env.GROQ_API_KEY;
  assert.equal((await POST(request({ prompt: "ramen" }))).status, 503);
  process.env.GROQ_API_KEY = "test-only";
  globalThis.fetch = () => {
    throw new Error("Must not call provider");
  };
  for (const value of [
    null,
    {},
    { prompt: " " },
    { prompt: 42 },
    { prompt: "x".repeat(1001) },
  ])
    assert.equal((await POST(request(value))).status, 400);
  assert.equal((await POST(request({ prompt: "x".repeat(9000) }))).status, 413);
});
test("Groq receives preferences and results exclude invented or duplicate restaurants", async () => {
  process.env.GROQ_API_KEY = "test-only";
  const id = restaurants[0].id;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-only");
    const payload = JSON.parse(options.body);
    assert.deepEqual(JSON.parse(payload.messages[1].content), {
      craving: "Vietnamese food",
      diet: "Vegetarian",
    });
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: "Try this spot",
              recommendations: [
                { id, reason: "Vietnamese cuisine" },
                { id, reason: "Duplicate" },
                { id: "invented", reason: "Fake" },
                null,
              ],
            }),
          },
        },
      ],
    });
  };
  const response = await POST(
    request({ prompt: "Vietnamese food", diet: "Vegetarian" }),
  );
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).recommendations, [
    { id, reason: "Vietnamese cuisine" },
  ]);
});
test("provider failures and malformed responses are retryable errors", async () => {
  process.env.GROQ_API_KEY = "test-only";
  globalThis.fetch = async () => new Response(null, { status: 429 });
  assert.equal((await POST(request({ prompt: "food" }))).status, 429);
  globalThis.fetch = async () =>
    Response.json({ choices: [{ message: { content: "invalid JSON" } }] });
  assert.equal((await POST(request({ prompt: "food" }))).status, 502);
});
test("Expo web can preflight the recommendation endpoint", () => {
  const response = OPTIONS();
  assert.equal(response.status, 204);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});
