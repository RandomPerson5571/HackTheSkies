import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import worker, { handleRequest } from "../src/index.ts";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const paths = [
  "food-scan",
  "food-recommendations",
];
test("Worker serves every migrated API with preflight, method checks and recoverable missing-key responses", async () => {
  for (const path of paths) {
    const url = `https://api.example.com/api/${path}`;
    const preflight = await worker.fetch(
      new Request(url, { method: "OPTIONS" }),
      {},
    );
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("Access-Control-Allow-Origin"), "*");
    const get = await worker.fetch(new Request(url), {});
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("Allow"), "POST, OPTIONS");
    const post = await worker.fetch(
      new Request(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuisine: "Japanese",
          diet: "No preference",
          neighborhood: "Toronto",
          budget: "home",
          collectedIds: [],
        }),
      }),
      {},
    );
    assert.equal(post.status, 503);
  }
  assert.deepEqual(
    await (
      await handleRequest(new Request("https://api.example.com/health"), {})
    ).json(),
    { status: "ok" },
  );
  for (const path of ["/", "/.env", "/api/missing", "/toString"])
    assert.equal(
      (await handleRequest(new Request(`https://api.example.com${path}`), {}))
        .status,
      404,
    );
});

test("request credentials come from Worker bindings without leaking between requests", async () => {
  const seen = [];
  globalThis.fetch = async (_url, options) => {
    seen.push(options.headers.Authorization);
    return Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              message: "No matches",
              recommendations: [],
            }),
          },
        },
      ],
    });
  };
  const request = () =>
    new Request("https://api.example.com/api/food-recommendations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "noodles" }),
    });
  assert.equal(
    (await worker.fetch(request(), { GROQ_API_KEY: "first-test-key" })).status,
    200,
  );
  assert.equal((await worker.fetch(request(), {})).status, 503);
  assert.equal(
    (await worker.fetch(request(), { GROQ_API_KEY: "second-test-key" })).status,
    200,
  );
  assert.deepEqual(seen, ["Bearer first-test-key", "Bearer second-test-key"]);
});
