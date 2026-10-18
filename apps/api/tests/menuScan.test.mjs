import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { afterEach, test } from "node:test";
import { POST as post, OPTIONS } from "../src/routes/menu-scan.ts";
import { handleRequest as handle } from "../src/index.ts";
const handleRequest = (request) => handle(request, process.env);
const originalFetch = globalThis.fetch;
const originalKey = process.env.GROQ_API_KEY;
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalKey;
});
const image = Buffer.from([255, 216, 255, 224, ...Array(20).fill(0)]).toString(
  "base64",
);
const req = (body = { image }) =>
  new Request("http://localhost/api/menu-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const answer = (data, reason = "stop") =>
  Response.json({
    choices: [
      { finish_reason: reason, message: { content: JSON.stringify(data) } },
    ],
  });
const dish = {
  name: "Tonkotsu Ramen",
  cuisine: "Japanese",
  description: "Pork noodle soup",
  dietaryFlags: ["meat"],
  box: { x: 0.1, y: 0.1, width: 0.7, height: 0.1 },
};
test("route is wired, supports preflight and missing configuration", async () => {
  delete process.env.GROQ_API_KEY;
  assert.equal((await handleRequest(req())).status, 503);
  assert.equal(OPTIONS().status, 204);
  assert.equal(
    (await handleRequest(new Request("http://localhost/api/menu-scan"))).status,
    405,
  );
});
test("rejects invalid and oversized images before provider calls", async () => {
  process.env.GROQ_API_KEY = "test";
  globalThis.fetch = () => {
    throw new Error("Unexpected call");
  };
  for (const body of [
    {},
    { image: "not an image" },
    { image: Buffer.from("this is not a jpeg photo").toString("base64") },
  ])
    assert.equal((await POST(req(body))).status, 400);
  assert.equal((await POST(req({ image: "A".repeat(8_001_025) }))).status, 413);
});
test("batched verification restricts canonical IDs to retrieved candidates", async () => {
  process.env.GROQ_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.type, "json_object");
    calls++;
    if (calls === 1)
      return answer({
        dishes: [
          { ...dish, catalogId: "pizza" },
          { ...dish, name: "Mystery special" },
        ],
      });
    assert.ok(body.messages[1].content.includes("ramen"));
    return answer({
      matches: [
        { id: "menu-0", catalogId: "ramen" },
        { id: "menu-1", catalogId: "fabricated-id" },
      ],
    });
  };
  const response = await POST(req());
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.dishes[0].catalogId, "ramen");
  assert.equal(result.dishes[1].catalogId, null);
  assert.equal(calls, 2);
});
test("non-menu images return no dishes without catalog calls", async () => {
  process.env.GROQ_API_KEY = "test";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return answer({ dishes: [] });
  };
  assert.deepEqual(await (await POST(req())).json(), { dishes: [] });
  assert.equal(calls, 1);
});
test("provider failures and incomplete responses do not expose internals", async () => {
  process.env.GROQ_API_KEY = "test";
  globalThis.fetch = async () =>
    new Response("secret provider detail", { status: 429 });
  const response = await POST(req());
  assert.equal(response.status, 429);
  assert.ok(!(await response.text()).includes("secret"));
  globalThis.fetch = async () => answer({ dishes: [dish] }, "length");
  assert.equal((await POST(req())).status, 502);
});

const POST = (request) => post(request, process.env);
