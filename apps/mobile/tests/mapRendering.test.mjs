import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { places } from "../src/features/restaurants/data/places.ts";
import {
  clusterMaxZoom,
  clusterRadius,
  createPlaceFeatures,
} from "../src/components/maps/placeFeatures.ts";

// Exercise the clustering engine installed with the browser's Mapbox dependency.
const requireMapbox = createRequire(import.meta.resolve("mapbox-gl"));
const { default: Supercluster } = await import(
  requireMapbox.resolve("supercluster")
);
const world = [-180, -85, 180, 85];
const cluster = (data) =>
  new Supercluster({
    maxZoom: clusterMaxZoom,
    radius: clusterRadius,
  }).load(data.features);

test("map payload retains all restaurant IDs without copying photos or detail metadata", () => {
  const data = createPlaceFeatures(places);
  assert.equal(data.features.length, places.length);
  const ids = new Set(
    data.features.map((feature) => feature.properties.placeId),
  );
  assert.equal(ids.size, places.length);
  for (const place of places) assert.ok(ids.has(place.id));
  // Photos and descriptive strings should never cross the worker/native bridge.
  assert.ok(!JSON.stringify(data).includes("https://"));
  assert.ok(JSON.stringify(data).length < JSON.stringify(places).length / 2);
});

test("the overview groups dense pins without dropping restaurants when zoomed in", () => {
  const data = createPlaceFeatures(places);
  const index = cluster(data);
  const overview = index.getClusters(world, 10);
  assert.ok(overview.length < places.length / 4);
  assert.equal(
    overview.reduce(
      (count, feature) => count + (feature.properties.point_count ?? 1),
      0,
    ),
    places.length,
  );
  const expanded = index.getClusters(world, clusterMaxZoom + 1);
  assert.equal(expanded.length, places.length);
  assert.deepEqual(
    new Set(expanded.map((feature) => feature.properties.placeId)),
    new Set(places.map((place) => place.id)),
  );
  for (const feature of overview.filter((item) => item.properties.cluster)) {
    assert.ok(
      index.getClusterExpansionZoom(feature.properties.cluster_id) > 10,
    );
  }
});

test("filtered and empty sources do not retain hidden restaurant pins", () => {
  assert.deepEqual(cluster(createPlaceFeatures([])).getClusters(world, 10), []);
  const filtered = places.filter((place) => place.category === "Coffee");
  const expanded = cluster(createPlaceFeatures(filtered)).getClusters(
    world,
    clusterMaxZoom + 1,
  );
  assert.deepEqual(
    new Set(expanded.map((feature) => feature.properties.placeId)),
    new Set(filtered.map((place) => place.id)),
  );
});
