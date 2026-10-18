import assert from "node:assert/strict";
import test from "node:test";
import {
  atlasPoint,
  atlasProgress,
  atlasSvg,
  cuisineAtPoint,
  cuisineCountries,
} from "../src/features/profile/models/culinaryAtlas.ts";
import { atlasCountries } from "../src/features/profile/data/atlasCountries.ts";
import { dishes } from "../src/features/food-dex/models/foodDex.ts";
const entry = (dish) => ({
  id: dish.id,
  name: dish.name,
  cuisine: dish.cuisine,
  photo: "",
  discoveredAt: "2026-10-17T12:00:00Z",
});
test("country hit testing and anchors use the same projection", () => {
  for (const [lon, lat, cuisine] of [
    [138, 36, "Japanese"],
    [12, 42, "Italian"],
    [-100, 39, "American"],
    [78, 22, "South Asian"],
    [108, 35, "Chinese"],
  ]) {
    const point = atlasPoint(lon, lat);
    assert.equal(cuisineAtPoint(point.x, point.y), cuisine);
  }
  assert.equal(cuisineAtPoint(1, 1), undefined);
  const codes = new Set(atlasCountries.map((country) => country.code));
  for (const code of Object.values(cuisineCountries).flat())
    assert.ok(codes.has(code), code);
});
test("Other never illuminates geography, even when its name matches a catalog dish", () => {
  const other = { ...entry(dishes[0]), cuisine: "Other" };
  assert.equal(atlasSvg([other]), atlasSvg([]));
  assert.equal(atlasProgress([other], "Japanese").discoveries, 0);
});
test("duplicates cannot inflate catalog progress and removal clears highlights", () => {
  const food = entry(dishes.find((dish) => dish.cuisine === "Japanese"));
  const row = atlasProgress(
    [food, { ...food, id: "duplicate", name: food.name.toUpperCase() }],
    "Japanese",
  );
  assert.equal(row.collected.length, 1);
  assert.equal(row.discoveries, 1);
  assert.notEqual(atlasSvg([food]), atlasSvg([]));
  assert.equal(atlasProgress([], "Japanese").collected.length, 0);
});
test("a shared catalog dish progresses each linked cuisine", () => {
  const shared = dishes.find((dish) => dish.cuisine === "Japanese");
  const original = shared.cuisineIds;
  shared.cuisineIds = [...original, "Thai"];
  try {
    for (const cuisine of shared.cuisineIds) {
      const row = atlasProgress([entry(shared)], cuisine);
      assert.equal(row.collected.length, 1);
      assert.equal(row.discoveries, 1);
    }
  } finally {
    shared.cuisineIds = original;
  }
});
