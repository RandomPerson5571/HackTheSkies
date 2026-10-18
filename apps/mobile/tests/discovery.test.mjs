import assert from "node:assert/strict";
import test from "node:test";
import {
  cardTier,
  cardTiers,
  collectionProgress,
  cuisineAnchors,
  cuisineConnections,
  exploredCuisines,
  project,
} from "../src/features/food-dex/models/discovery.ts";
import { cuisines, dishes } from "../src/features/food-dex/models/foodDex.ts";
import { landDots } from "../src/features/food-dex/data/globeLand.ts";
const ramen = {
  id: "1",
  name: "Ramen",
  cuisine: "Japanese",
  photo: "",
  discoveredAt: "2026-10-17T12:00:00Z",
};

test("card tiers stay stable across case, spacing, and Unicode variants", () => {
  assert.equal(
    cardTier(" RＡＭＥＮ ", "Japanese"),
    cardTier("Ramen", "Japanese"),
  );
  assert.equal(
    cardTier(" My own dish ", "Other"),
    cardTier("my own dish", "Other"),
  );
  const tiers = new Set(
    dishes.map((dish) => cardTier(dish.name, dish.cuisine)),
  );
  assert.deepEqual(tiers, new Set(Object.keys(cardTiers)));
});

test("only unique catalog matches advance catalog completion", () => {
  const before = collectionProgress([]);
  const after = collectionProgress([
    ramen,
    { ...ramen, id: "2", name: "RAMEN" },
  ]);
  assert.equal(after.total, dishes.length);
  assert.equal(before.collected, 0);
  assert.equal(after.collected, 1);
  assert.ok(after.fraction > 0 && after.fraction <= 1);
  assert.equal(collectionProgress([ramen], "Thai").collected, 0);
  assert.equal(
    collectionProgress([{ ...ramen, name: "My recipe" }]).collected,
    0,
  );
  assert.deepEqual(collectionProgress([ramen], "Other"), {
    collected: 0,
    total: 0,
    fraction: 0,
  });
});

test("atlas lights known cuisine anchors once and clears them after removal", () => {
  assert.deepEqual(exploredCuisines([ramen, { ...ramen, id: "2" }]), [
    "Japanese",
  ]);
  assert.deepEqual(exploredCuisines([{ ...ramen, cuisine: "Other" }]), []);
  assert.deepEqual(exploredCuisines([]), []);
  assert.deepEqual(
    Object.keys(cuisineAnchors).sort(),
    cuisines.filter((cuisine) => cuisine !== "Other").sort(),
  );
});

test("flavor connections are backed by dishes in both cuisines", () => {
  for (const cuisine of Object.keys(cuisineAnchors)) {
    const connections = cuisineConnections(cuisine);
    assert.ok(connections.length > 0 && connections.length <= 3, cuisine);
    for (const edge of connections) {
      assert.notEqual(edge.cuisine, cuisine);
      assert.ok(cuisineAnchors[edge.cuisine]);
      assert.ok(edge.regions.length);
      for (const shared of edge.shared) {
        assert.ok(shared.from.cuisineIds.includes(cuisine));
        assert.ok(shared.to.cuisineIds.includes(edge.cuisine));
        assert.ok(shared.theme);
      }
    }
  }
});

test("globe projection hides the far side and wraps around the dateline", () => {
  assert.equal(project([0, 0], 0).visible, true);
  assert.equal(project([180, 0], 0).visible, false);
  assert.equal(project([138, 36], 138).visible, true);
  assert.ok(
    Math.abs(project([20, 30], 10).x - project([20, 30], 370).x) < 1e-9,
  );
  for (const coordinate of landDots) {
    const point = project(coordinate, 120);
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= 276 && point.y >= 0 && point.y <= 276);
  }
  assert.ok(landDots.length > 200);
});
