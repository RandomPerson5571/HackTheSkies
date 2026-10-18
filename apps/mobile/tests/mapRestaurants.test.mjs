import assert from "node:assert/strict";
import test from "node:test";
import {
  canLoadMapRestaurants,
  mergeMapRestaurants,
  osmRestaurants,
  withinBounds,
  fetchMapRestaurants,
  isTorontoDemo,
  isTorontoOnly,
  discoveryBounds,
  discoveryKey,
} from "../src/lib/mapRestaurants.ts";

const quebec = [-71.23, 46.8, -71.2, 46.83];
const elements = [
  {
    type: "node",
    id: 1,
    lon: -71.21,
    lat: 46.81,
    tags: { name: "Québec café", amenity: "cafe", "addr:city": "Québec" },
  },
  {
    type: "way",
    id: 2,
    center: { lon: -71.22, lat: 46.82 },
    tags: { name: "Restaurant", amenity: "restaurant" },
  },
];
test("Quebec OSM nodes and buildings become selectable restaurant listings without invented ratings", () => {
  const places = osmRestaurants(elements);
  assert.equal(places.length, 2);
  assert.equal(places[0].category, "Coffee");
  assert.equal(places[0].address, "Québec");
  assert.equal(places[1].id, "osm-way-2");
  assert.ok(places.every((p) => withinBounds(p, quebec)));
  assert.ok(
    places.every(
      (p) => p.rating === undefined && p.confirmedDietaryOptions === undefined,
    ),
  );
  assert.equal(osmRestaurants([{ ...elements[0], lon: NaN }]).length, 0);
});
test("database responses retain discovered restaurants and update duplicate IDs", () => {
  const places = osmRestaurants(elements);
  assert.deepEqual(mergeMapRestaurants(places, []), places);
  const updated = { ...places[0], name: "Updated" };
  assert.deepEqual(mergeMapRestaurants(places, [updated]), [
    updated,
    places[1],
  ]);
});
test("city queries are allowed while oversized and invalid viewports do not hit the public service", () => {
  assert.equal(canLoadMapRestaurants(quebec, 12), true);
  assert.equal(canLoadMapRestaurants([-80, 40, -60, 60], 5), false);
  assert.equal(canLoadMapRestaurants([NaN, 0, 1, 1], 12), false);
});
test("lookup uses the viewed Quebec bounds and propagates cancellation", async (t) => {
  const controller = new AbortController();
  const previousUrl = process.env.EXPO_PUBLIC_API_URL;
  process.env.EXPO_PUBLIC_API_URL = "https://cibo.test";
  t.after(() => {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_API_URL;
    else process.env.EXPO_PUBLIC_API_URL = previousUrl;
  });
  t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(new URL(url).pathname, "/api/map-restaurants");
    assert.equal(options.signal, controller.signal);
    assert.equal(
      new URL(url).searchParams.get("bounds"),
      discoveryBounds(quebec).join(","),
    );
    return Response.json({ places: osmRestaurants(elements) });
  });
  assert.equal(
    (await fetchMapRestaurants(quebec, controller.signal)).length,
    2,
  );
});

test("Toronto demo policy excludes live discoveries while boundary views still fetch outside", () => {
  assert.equal(isTorontoDemo({ coordinate: [-79.4, 43.7] }), true);
  assert.equal(isTorontoOnly([-79.5, 43.6, -79.3, 43.8]), true);
  assert.equal(isTorontoOnly([-79.7, 43.6, -79.3, 43.8]), false);
  assert.equal(isTorontoDemo({ coordinate: [-71.21, 46.81] }), false);
});
test("small pans share a cache key and rounded bounds cover the entire view", () => {
  assert.equal(
    discoveryKey([-71.229, 46.801, -71.201, 46.829]),
    discoveryKey([-71.228, 46.802, -71.202, 46.828]),
  );
  const rounded = discoveryBounds(quebec);
  assert.ok(
    rounded[0] <= quebec[0] &&
      rounded[1] <= quebec[1] &&
      rounded[2] >= quebec[2] &&
      rounded[3] >= quebec[3],
  );
});
