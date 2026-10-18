import assert from "node:assert/strict";
import process from "node:process";
import { Buffer } from "node:buffer";
import { afterEach, test } from "node:test";
import { POST as post, OPTIONS } from "../src/routes/food-scan.ts";
import { cuisines } from "../../../packages/food-catalog/src/cuisines.ts";
import { catalogDishes } from "../../../packages/food-catalog/data/catalog.ts";
import {
  retrieveFoodCandidates,
  MAX_FOOD_CANDIDATES,
} from "../src/services/food-catalog.ts";
const originalKey = process.env.GROQ_API_KEY;
const originalModel = process.env.GROQ_FOOD_SCAN_MODEL;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GROQ_FOOD_SCAN_MODEL;
  else process.env.GROQ_FOOD_SCAN_MODEL = originalModel;
});
const jpeg = Buffer.from([
  255,
  216,
  255,
  224,
  ...new Array(20).fill(0),
]).toString("base64");
const request = (value) =>
  new Request("http://localhost/api/food-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
const answer = (value, reason = "stop") =>
  Response.json({
    choices: [
      { finish_reason: reason, message: { content: JSON.stringify(value) } },
    ],
  });
const observation = (
  name = "Tonkotsu Ramen",
  cuisine = "Japanese",
  description = "Noodles in broth with sliced pork and egg",
) => ({ name, cuisine, description });

test("unconfigured recognition and browser preflight remain recoverable", async () => {
  delete process.env.GROQ_API_KEY;
  const response = await POST(request({ image: jpeg }));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("access-control-allow-origin"), "*");
  assert.equal(OPTIONS().status, 204);
});
test("malformed, non-image and oversized requests never reach Groq", async () => {
  process.env.GROQ_API_KEY = "test-only";
  globalThis.fetch = () => {
    throw new Error("Provider must not be called");
  };
  for (const value of [
    {},
    null,
    { image: "nope" },
    { image: "abcd".repeat(20) },
  ])
    assert.equal((await POST(request(value))).status, 400);
  assert.equal(
    (await POST(request({ image: "a".repeat(8_002_000) }))).status,
    413,
  );
  assert.equal(
    (
      await POST(
        new Request("http://localhost/api/food-scan", {
          method: "POST",
          body: "{}",
        }),
      )
    ).status,
    415,
  );
});
test("vision identifies first, then verifies only candidates retrieved from that category", async () => {
  process.env.GROQ_API_KEY = "test-only";
  delete process.env.GROQ_FOOD_SCAN_MODEL;
  let calls = 0;
  let deadline;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(options.headers.Authorization, "Bearer test-only");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "qwen/qwen3.8-27b");
    assert.match(
      body.messages[1].content[1].image_url.url,
      /^data:image\/jpeg;base64,/,
    );
    const format = body.response_format;
    assert.equal(format.type, "json_schema");
    assert.equal(format.json_schema.strict, true);
    assert.equal(format.json_schema.schema.additionalProperties, false);
    const prompt = body.messages[0].content;
    if (calls === 1) {
      deadline = options.signal;
      assert.equal(format.json_schema.name, "food_observation");
      assert.deepEqual(
        format.json_schema.schema.properties.cuisine.enum,
        cuisines,
      );
      assert.ok(prompt.length < 2_000);
      assert.doesNotMatch(prompt, /Catalog|Candidates:|Spanakopita/);
      assert.match(prompt, /Mexican food belongs to Latin/);
      assert.match(prompt, /Iran, Iraq, Afghanistan/);
      return answer(observation());
    }
    assert.equal(
      options.signal,
      deadline,
      "both calls share one cancellation/deadline signal",
    );
    assert.equal(format.json_schema.name, "food_catalog_match");
    const candidates = JSON.parse(prompt.split("Candidates: ")[1]);
    assert.ok(candidates.length <= MAX_FOOD_CANDIDATES);
    assert.ok(candidates.every((dish) => dish.cuisine === "Japanese"));
    assert.ok(
      candidates.some((dish) => dish.id === "ramen" && dish.description),
    );
    assert.ok(prompt.length < 6_000);
    assert.deepEqual(format.json_schema.schema.properties.catalogId.enum, [
      ...candidates.map((dish) => dish.id),
      "NO_MATCH",
    ]);
    return answer({ catalogId: "ramen" });
  };
  assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
    foodDetected: true,
    foodName: "Ramen",
    foodId: "ramen",
    name: "Ramen",
    cuisine: "Japanese",
    catalogId: "ramen",
  });
  assert.equal(calls, 2);
});
test("retrieval bounds large categories and ranks canonical names including accents first", () => {
  for (const dish of catalogDishes) {
    const candidates = retrieveFoodCandidates(dish.cuisine, dish.name, "");
    assert.ok(
      candidates.some((candidate) => candidate.id === dish.id),
      dish.name,
    );
    assert.ok(candidates.length <= MAX_FOOD_CANDIDATES);
    assert.ok(
      candidates.every((candidate) => candidate.description.length <= 200),
    );
  }
  const candidates = retrieveFoodCandidates(
    "Vietnamese",
    "Pho",
    "Rice noodles in broth",
  );
  assert.equal(candidates[0].name, "Phở");
  assert.equal(candidates.length, MAX_FOOD_CANDIDATES);
  assert.equal(
    retrieveFoodCandidates("Japanese", "Tonkotsu Ramen", "")[0].id,
    "ramen",
  );
  assert.deepEqual(retrieveFoodCandidates("Other", "Unlisted food", ""), []);
});
test("NO_MATCH preserves a custom discovery without awarding a catalog badge", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const cuisine of cuisines) {
    let calls = 0;
    globalThis.fetch = async () =>
      ++calls === 1
        ? answer(observation("Custom dish", cuisine, "Unknown preparation"))
        : answer({ catalogId: "NO_MATCH" });
    assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
      foodDetected: true,
      foodName: "Custom dish",
      foodId: null,
      name: "Custom dish",
      cuisine,
      catalogId: null,
    });
    assert.equal(calls, cuisine === "Other" ? 1 : 2);
  }
});
test("an exact canonical name corrects a mistaken category before verification", async () => {
  process.env.GROQ_API_KEY = "test-only";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    if (++calls === 1)
      return answer(observation("Spanakopita", "Levant", "Spinach pastry"));
    const body = JSON.parse(options.body);
    const candidates = JSON.parse(
      body.messages[0].content.split("Candidates: ")[1],
    );
    assert.ok(candidates.every((dish) => dish.cuisine === "Greek"));
    assert.ok(candidates.some((dish) => dish.id === "spanakopita"));
    return answer({ catalogId: "spanakopita" });
  };
  assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
    foodDetected: true,
    foodName: "Spanakopita",
    foodId: "spanakopita",
    name: "Spanakopita",
    cuisine: "Greek",
    catalogId: "spanakopita",
  });
});
test("a verifier cannot award invented or non-retrieved IDs, even if they exist elsewhere", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const catalogId of ["invented", "pizza", null, undefined]) {
    let calls = 0;
    globalThis.fetch = async () =>
      ++calls === 1 ? answer(observation()) : answer({ catalogId });
    assert.equal((await POST(request({ image: jpeg }))).status, 502);
  }
});
test("non-food images never fabricate a discovery or trigger verification", async () => {
  process.env.GROQ_API_KEY = "test-only";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return answer(observation("", "Other", ""));
  };
  assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
    foodDetected: false,
    foodName: "",
    foodId: null,
    name: "",
    cuisine: "Other",
    catalogId: null,
  });
  assert.equal(calls, 1);
});
test("configured vision models keep JSON-object compatibility and server validation", async () => {
  process.env.GROQ_API_KEY = "test-only";
  process.env.GROQ_FOOD_SCAN_MODEL = "test-vision-model";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, "test-vision-model");
    assert.deepEqual(body.response_format, { type: "json_object" });
    return ++calls === 1
      ? answer(observation("Spanakopita", "Greek", "Spinach pastry"))
      : answer({ catalogId: "spanakopita" });
  };
  assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
    foodDetected: true,
    foodName: "Spanakopita",
    foodId: "spanakopita",
    name: "Spanakopita",
    cuisine: "Greek",
    catalogId: "spanakopita",
  });
});
test("provider failures and invalid observations stop before retrieval verification", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const response of [
    new Response("failure", { status: 500 }),
    answer(observation("Dish", "Invalid")),
    answer({ name: "Dish", cuisine: "Japanese" }),
    answer(null),
    answer(observation(), "length"),
    Response.json({
      choices: [{ finish_reason: "stop", message: { content: "not JSON" } }],
    }),
  ]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return response;
    };
    assert.equal((await POST(request({ image: jpeg }))).status, 502);
    assert.equal(calls, 1);
  }
});
test("verification failures remain retryable and never silently award a badge", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const failure of [
    answer({ catalogId: "ramen" }, "length"),
    answer(null),
    new Response("failure", { status: 500 }),
  ]) {
    let calls = 0;
    globalThis.fetch = async () =>
      ++calls === 1 ? answer(observation()) : failure;
    assert.equal((await POST(request({ image: jpeg }))).status, 502);
  }
});
test("provider rate limits from either stage are retryable without exposing details", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const stage of [1, 2]) {
    let calls = 0;
    globalThis.fetch = async () =>
      ++calls === stage
        ? new Response("private provider details", { status: 429 })
        : answer(observation());
    const response = await POST(request({ image: jpeg }));
    assert.equal(response.status, 429);
    assert.deepEqual(await response.json(), {
      error: "Recognition is temporarily unavailable.",
    });
  }
});
test("client cancellation reaches either provider call and prevents further work", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const stage of [1, 2]) {
    const controller = new AbortController();
    const req = new Request("http://localhost/api/food-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: jpeg }),
      signal: controller.signal,
    });
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      if (++calls < stage) return answer(observation());
      controller.abort();
      assert.equal(options.signal.aborted, true);
      throw new DOMException("Aborted", "AbortError");
    };
    assert.equal((await POST(req)).status, 502);
    assert.equal(calls, stage);
  }
});
test("cancellation after observation prevents starting the verifier", async () => {
  process.env.GROQ_API_KEY = "test-only";
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort();
    return answer(observation());
  };
  const req = new Request("http://localhost/api/food-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: jpeg }),
    signal: controller.signal,
  });
  assert.equal((await POST(req)).status, 502);
  assert.equal(calls, 1);
});

const POST = (request) => post(request, process.env);

test("Groq-only localization validates coordinates and confidence independently of identity", async () => {
  process.env.GROQ_API_KEY = "test-only";
  for (const [bbox, locationConfidence, expected] of [
    [[180, 220, 820, 780], "medium", true],
    [[180, 220, 820, 780], "low", false],
    [[0, 0, 0, 0], "high", false],
    [[820, 220, 180, 780], "high", false],
    [[-1, 220, 820, 780], "medium", false],
    [["180", 220, 820, 780], "medium", false],
    [null, "high", false],
  ]) {
    globalThis.fetch = async () =>
      answer({
        ...observation("Unknown meal", "Other", ""),
        foodDetected: true,
        bbox,
        locationConfidence,
      });
    const response = await post(request({ image: jpeg }), {
      GROQ_API_KEY: "test-only",
    });
    const value = await response.json();
    assert.equal(value.foodDetected, true);
    assert.equal(value.foodName, "Unknown meal");
    assert.equal(value.foodId, null);
    assert.equal("bbox" in value, expected);
    if (expected) assert.deepEqual(value.bbox, bbox);
  }
});
