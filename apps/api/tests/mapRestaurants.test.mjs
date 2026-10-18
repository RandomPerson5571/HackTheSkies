import assert from "node:assert/strict";
import test from "node:test";
import { GET, OPTIONS } from "../src/routes/map-restaurants.ts";
import { handleRequest } from "../src/index.ts";
const request = (bounds) =>
  new Request(`https://cibo.test/api/map-restaurants?bounds=${bounds}`);
const quebec = "-71.23,46.8,-71.2,46.83";
const restaurant = (id, lon, lat) => ({
  type: "node",
  id,
  lon,
  lat,
  tags: { amenity: "restaurant", name: `Restaurant ${id}` },
});

test("invalid/oversized bounds are rejected without a provider call", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Must not fetch");
  });
  for (const bounds of [
    "",
    "NaN,46,-71,47",
    "-80,40,-60,60",
    "-71,,1,2",
    "-71,47,-72,46",
    "-181,1,-180,2",
  ])
    assert.equal((await GET(request(bounds))).status, 400);
});
test("Toronto demo never requests live restaurants", async (t) => {
  t.mock.method(globalThis, "fetch", () => {
    throw new Error("Must not fetch");
  });
  const result = await GET(request("-79.5,43.6,-79.3,43.8"));
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { places: [], source: "csv-only" });
});
test("boundary views load outside Toronto and exclude all live Toronto venues", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return Response.json({
      elements: [
        restaurant(1, -79.66, 43.7),
        restaurant(2, -79.4, 43.7),
        restaurant(3, -71.2, 46.8),
      ],
    });
  });
  const result = await GET(request("-79.7,43.65,-79.3,43.8"));
  assert.deepEqual(
    (await result.json()).places.map((p) => p.id),
    ["osm-node-1"],
  );
  assert.equal(calls, 1);
});
test("provider failures fall back; successful areas use a shared server cache", async (t) => {
  const entries = new Map();
  const previousCaches = globalThis.caches;
  t.after(() => {
    if (previousCaches === undefined) delete globalThis.caches;
    else globalThis.caches = previousCaches;
  });
  globalThis.caches = {
    default: {
      match: async (key) => entries.get(key.url)?.clone(),
      put: async (key, response) => {
        entries.set(key.url, response);
      },
    },
  };
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    return calls === 1
      ? new Response("busy", { status: 503 })
      : Response.json({ elements: [restaurant(1, -71.21, 46.81)] });
  });
  const result = await GET(request(quebec));
  assert.equal(result.status, 200);
  assert.equal((await result.json()).places.length, 1);
  assert.equal(calls, 2);
  assert.equal(
    (await GET(request("-71.229,46.801,-71.201,46.829"))).status,
    200,
  );
  assert.equal(calls, 2);
});
test("incomplete and failed responses are not presented or cached as zero restaurants", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ elements: [], remark: "timeout" }),
  );
  const result = await GET(request(quebec));
  assert.equal(result.status, 503);
  assert.equal(result.headers.get("Cache-Control"), "no-store");
});
test("router exposes discovery with GET and CORS without requiring AI keys", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({ elements: [] }),
  );
  assert.equal((await handleRequest(request(quebec), {})).status, 200);
  assert.equal(
    OPTIONS().headers.get("Access-Control-Allow-Methods"),
    "GET, OPTIONS",
  );
  const wrongMethod = new Request("https://cibo.test/api/map-restaurants", {
    method: "POST",
  });
  assert.equal((await handleRequest(wrongMethod, {})).status, 405);
});
