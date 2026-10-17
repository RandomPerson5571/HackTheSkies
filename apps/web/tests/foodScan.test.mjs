import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { POST } from "../app/api/food-scan/route.ts";
import { cuisines } from "../../../packages/food-catalog/src/cuisines.ts";

const originalKey = process.env.OPENAI_API_KEY;
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalKey;
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

test("unconfigured recognition returns an actionable unavailable response", async () => {
  delete process.env.OPENAI_API_KEY;
  assert.equal((await POST(request({ image: jpeg }))).status, 503);
});

test("malformed, non-image, and oversized inputs never reach the provider", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.fetch = () => {
    throw new Error("Provider must not be called");
  };
  for (const value of [{}, { image: "nope" }, { image: "abcd".repeat(20) }])
    assert.equal((await POST(request(value))).status, 400);
  assert.equal(
    (await POST(request({ image: "a".repeat(8_002_000) }))).status,
    413,
  );
});

test("recognition returns only validated dish data and keeps credentials server-side", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    assert.equal(options.headers.Authorization, "Bearer test-only");
    const body = JSON.parse(options.body);
    assert.deepEqual(body.text.format.schema.properties.cuisine.enum, cuisines);
    assert.match(body.instructions, /Mexican food belongs to Latin/);
    assert.match(body.instructions, /Iran, Iraq, Afghanistan/);
    assert.equal(body.store, false);
    assert.ok(
      body.input[0].content[1].image_url.startsWith("data:image/jpeg;base64,"),
    );
    return Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: JSON.stringify({ name: " Ramen ", cuisine: "Japanese" }),
            },
          ],
        },
      ],
    });
  };
  assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
    name: "Ramen",
    cuisine: "Japanese",
  });
});

test("recognition accepts every expanded cuisine group", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  for (const cuisine of cuisines) {
    globalThis.fetch = async () =>
      Response.json({
        status: "completed",
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({ name: "Dish", cuisine }),
              },
            ],
          },
        ],
      });
    assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
      name: "Dish",
      cuisine,
    });
  }
});

test("no-food and incomplete responses never fabricate a discovery", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  for (const body of [
    { status: "incomplete", output: [] },
    {
      status: "completed",
      output: [{ content: [{ type: "refusal", refusal: "Unable" }] }],
    },
    {
      status: "completed",
      output: [
        {
          content: [
            { type: "output_text", text: '{"name":"","cuisine":"Other"}' },
          ],
        },
      ],
    },
  ]) {
    globalThis.fetch = async () => Response.json(body);
    assert.deepEqual(await (await POST(request({ image: jpeg }))).json(), {
      name: "",
      cuisine: "Other",
    });
  }
});

test("provider failures and invalid cuisines become recoverable errors", async () => {
  process.env.OPENAI_API_KEY = "test-only";
  for (const response of [
    new Response("failure", { status: 429 }),
    Response.json({
      status: "completed",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: '{"name":"Ramen","cuisine":"Invalid"}',
            },
          ],
        },
      ],
    }),
  ]) {
    globalThis.fetch = async () => response;
    assert.equal((await POST(request({ image: jpeg }))).status, 502);
  }
});
