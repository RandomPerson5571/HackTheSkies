import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createGroqClient } from "../src/services/groq.ts";
import { POST as recommend } from "../src/routes/food-recommendations.ts";
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
const env = {
  GROQ_API_KEY: "first",
  GROQ_API_KEY_1: "second",
  GROQ_API_KEY_2: "third",
};
const options = { method: "POST", body: "{}" };

test("429 rotates keys, cancels discarded bodies and retains the working key", async () => {
  const seen = [];
  let canceled = 0;
  globalThis.fetch = async (_, init) => {
    seen.push(init.headers.Authorization);
    assert.equal(init.body, options.body);
    if (seen.length < 3)
      return new Response(
        new ReadableStream({
          cancel() {
            canceled++;
          },
        }),
        { status: 429 },
      );
    return new Response("ok");
  };
  const groq = createGroqClient(env);
  assert.equal((await groq(options)).status, 200);
  await groq(options);
  assert.deepEqual(seen, [
    "Bearer first",
    "Bearer second",
    "Bearer third",
    "Bearer third",
  ]);
  assert.equal(canceled, 2);
});

test("all rate limited keys return 429 after exactly three attempts", async () => {
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response(null, { status: 429 });
  };
  assert.equal((await createGroqClient(env)(options)).status, 429);
  assert.equal(calls, 3);
});

test("blank and duplicate keys are skipped", async () => {
  assert.equal(createGroqClient({ GROQ_API_KEY: " " }), undefined);
  let calls = 0;
  globalThis.fetch = async (_, init) => {
    calls++;
    assert.equal(init.headers.Authorization, "Bearer backup");
    return new Response(null, { status: 429 });
  };
  assert.equal(
    (
      await createGroqClient({
        GROQ_API_KEY_1: "backup",
        GROQ_API_KEY_2: "backup",
      })(options)
    ).status,
    429,
  );
  assert.equal(calls, 1);
});

for (const status of [200, 401, 500])
  test(`status ${status} does not rotate`, async () => {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return new Response(null, { status });
    };
    assert.equal((await createGroqClient(env)(options)).status, status);
    assert.equal(calls, 1);
  });

test("aborting during a 429 prevents further attempts", async () => {
  const controller = new AbortController();
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    controller.abort();
    return new Response(null, { status: 429 });
  };
  await assert.rejects(
    createGroqClient(env)({ ...options, signal: controller.signal }),
    { name: "AbortError" },
  );
  assert.equal(calls, 1);
});

test("recommendations recover from a rate limit using a backup key", async () => {
  const seen = [];
  globalThis.fetch = async (_, init) => {
    seen.push(init.headers.Authorization);
    return seen.length === 1
      ? new Response(null, { status: 429 })
      : Response.json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  message: "Try again",
                  recommendations: [],
                }),
              },
            },
          ],
        });
  };
  const result = await recommend(
    new Request("http://localhost/api/food-recommendations", {
      method: "POST",
      body: JSON.stringify({ prompt: "ramen" }),
    }),
    env,
  );
  assert.equal(result.status, 200);
  assert.deepEqual(seen, ["Bearer first", "Bearer second"]);
});

test("food-scan route rotates in both stages and retains the selected key", async () => {
  const { handleRequest } = await import("../src/index.ts");
  const seen = [];
  const bodies = [];
  const signals = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    seen.push(init.headers.Authorization);
    bodies.push(init.body);
    signals.push(init.signal);
    if (seen.length === 1 || seen.length === 3)
      return new Response(null, { status: 429 });
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            content: JSON.stringify(
              seen.length === 2
                ? {
                    foodDetected: true,
                    name: "Ramen",
                    cuisine: "Japanese",
                    description: "Noodles in broth",
                  }
                : { catalogId: "NO_MATCH" },
            ),
          },
        },
      ],
    });
  };
  const image = Buffer.from([
    255,
    216,
    255,
    224,
    ...new Array(20).fill(0),
  ]).toString("base64");
  const response = await handleRequest(
    new Request("http://localhost/api/food-scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
    }),
    env,
  );
  assert.equal(response.status, 200);
  assert.equal((await response.json()).foodDetected, true);
  assert.deepEqual(seen, [
    "Bearer first",
    "Bearer second",
    "Bearer second",
    "Bearer third",
  ]);
  assert.equal(bodies[0], bodies[1]);
  assert.equal(bodies[2], bodies[3]);
  assert.ok(signals.every((signal) => signal === signals[0]));
});
