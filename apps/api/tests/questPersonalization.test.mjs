import assert from "node:assert/strict";
import test from "node:test";
import { POST as post, OPTIONS } from "../src/routes/quest-personalization.ts";
import { handleRequest as handle } from "../src/index.ts";
const handleRequest = (request) => handle(request, process.env);

const preferences = {
  cuisine: "Japanese",
  diet: "No preference",
  neighborhood: "Toronto",
  budget: "home",
  collectedIds: ["ramen"],
};
const request = (input) =>
  new Request("http://localhost/api/quest-personalization", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
const result = (value, finish_reason = "stop") =>
  Response.json({
    choices: [{ finish_reason, message: { content: JSON.stringify(value) } }],
  });
test("quest endpoint is wired, has preflight and validates bounded preferences", async () => {
  assert.equal(OPTIONS().status, 204);
  assert.equal(
    (
      await handleRequest(
        new Request("http://localhost/api/quest-personalization"),
      )
    ).status,
    405,
  );
  assert.equal((await POST(request(null))).status, 400);
  assert.equal(
    (await POST(request({ ...preferences, cuisine: "invented" }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ ...preferences, collectedIds: "ramen" }))).status,
    400,
  );
  assert.equal(
    (await POST(request({ ...preferences, extra: "x".repeat(9000) }))).status,
    413,
  );
});
test("missing configuration is recoverable", async () => {
  const key = process.env.GROQ_API_KEY;
  delete process.env.GROQ_API_KEY;
  try {
    assert.equal((await POST(request(preferences))).status, 503);
  } finally {
    if (key !== undefined) process.env.GROQ_API_KEY = key;
  }
});
test("AI can only choose an undiscovered catalog dish and cannot invent a restaurant", async (t) => {
  t.mock.method(globalThis, "fetch", async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.ok(body.messages[0].content.includes('"id":"sushi"'));
    assert.ok(!body.messages[0].content.includes('"id":"ramen"'));
    return result({
      dishId: "sushi",
      restaurantId: "invented",
      reason: "Learn a new dish at home.",
    });
  });
  const key = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test";
  try {
    const response = await POST(request(preferences));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      dishId: "sushi",
      restaurantId: null,
      reason: "Learn a new dish at home.",
      template: "learn",
    });
  } finally {
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
  }
});
test("dietary preferences enforce learning and provider failures stay retryable", async (t) => {
  const key = process.env.GROQ_API_KEY;
  process.env.GROQ_API_KEY = "test";
  let mode = "success";
  t.mock.method(globalThis, "fetch", async () =>
    mode === "rate-limit"
      ? new Response(null, { status: 429 })
      : result(
          {
            dishId: mode === "invalid" ? "ramen" : "sushi",
            reason: "Explore the ingredients.",
          },
          mode === "truncated" ? "length" : "stop",
        ),
  );
  try {
    const response = await POST(
      request({ ...preferences, budget: "flexible", diet: "Vegan" }),
    );
    assert.equal((await response.json()).template, "learn");
    for (const value of ["invalid", "truncated", "rate-limit"]) {
      mode = value;
      assert.equal(
        (await POST(request(preferences))).status,
        value === "rate-limit" ? 429 : 502,
      );
    }
  } finally {
    if (key === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = key;
  }
});

const POST = (request) => post(request, process.env);
