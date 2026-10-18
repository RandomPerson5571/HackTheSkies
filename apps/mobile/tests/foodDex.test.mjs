import assert from "node:assert/strict";
import test from "node:test";
import {
  addFood,
  parseFoodDex,
  foodKey,
  dishes,
  cuisines,
  cuisineRegions,
  cuisineCovers,
  findCatalogDish,
} from "../src/features/food-dex/models/foodDex.ts";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ramen = {
  id: "one",
  name: "Ramen",
  cuisine: "Japanese",
  photo: "file:///ramen.jpg",
  discoveredAt: "2026-10-17T12:00:00.000Z",
};

test("repeat discoveries cannot inflate cuisine progress", () => {
  const state = addFood([], ramen);
  assert.equal(
    addFood(state, { ...ramen, id: "two", name: "  RAMEN  " }),
    state,
  );
  assert.equal(
    addFood(state, { ...ramen, id: "two", name: "Ｒａｍｅｎ" }),
    state,
  );
  assert.equal(addFood(state, { ...ramen, name: " " }), state);
  assert.equal(addFood(state, { ...ramen, cuisine: "Invalid" }), state);
  assert.equal(
    addFood(state, { ...ramen, id: "two", cuisine: "Other" }).length,
    2,
  );
  assert.equal(state.length, 1);
});

test("restoring preserves photos and dates while deduplicating discoveries", () => {
  assert.deepEqual(parseFoodDex(JSON.stringify([ramen])), [ramen]);
  assert.deepEqual(
    parseFoodDex(
      JSON.stringify([ramen, { ...ramen, id: "two", name: "RAMEN" }]),
    ),
    [ramen],
  );
  for (const value of [
    "not json",
    "null",
    "{}",
    "[null]",
    JSON.stringify([{ ...ramen, cuisine: "Bad" }]),
    JSON.stringify([{ ...ramen, discoveredAt: "bad" }]),
  ])
    assert.throws(() => parseFoodDex(value));
});

test("starter catalog has unique cuisine keys and supports custom foods", () => {
  const keys = dishes.map((dish) => foodKey(dish.name, dish.cuisine));
  assert.equal(keys.length, new Set(keys).size);
  assert.ok(dishes.every((dish) => cuisines.includes(dish.cuisine)));
  const custom = addFood([ramen], { ...ramen, id: "two", name: "  Udon  " });
  assert.equal(custom[0].name, "Udon");
  assert.equal(custom.length, 2);
});

test("saved Indian and Mexican discoveries migrate before deduplication", () => {
  const legacy = [
    { ...ramen, name: "Dosa", cuisine: "Indian" },
    { ...ramen, id: "duplicate", name: "DOSA", cuisine: "South Asian" },
    { ...ramen, id: "tacos", name: "Tacos", cuisine: "Mexican" },
  ];
  const restored = parseFoodDex(JSON.stringify(legacy));
  assert.equal(restored.length, 2);
  assert.equal(restored[0].cuisine, "South Asian");
  assert.equal(restored[1].cuisine, "Latin");
  assert.equal(restored[0].photo, ramen.photo);
  assert.equal(restored[0].discoveredAt, ramen.discoveredAt);
});

test("all requested cuisine groups and regions are represented", () => {
  assert.deepEqual(cuisines, [
    "Chinese",
    "Korean",
    "Japanese",
    "Vietnamese",
    "Thai",
    "South Asian",
    "Levant",
    "Greek",
    "Persian",
    "French",
    "Italian",
    "Latin",
    "Caribbean",
    "American",
    "Drinks",
    "Other",
  ]);
  for (const cuisine of cuisines.filter((cuisine) => cuisine !== "Other")) {
    assert.ok(
      dishes.some((dish) => dish.cuisine === cuisine),
      cuisine,
    );
    for (const region of cuisineRegions[cuisine]) {
      assert.ok(
        dishes.some(
          (dish) => dish.cuisine === cuisine && dish.regions.includes(region),
        ),
        region,
      );
    }
  }
});

test("cuisine covers are actual dishes from their own collections", () => {
  for (const cuisine of cuisines.filter((cuisine) => cuisine !== "Other")) {
    const cover = cuisineCovers[cuisine];
    assert.equal(cover.cuisine, cuisine);
    assert.ok(cover.image?.localPath, `Missing cover image for ${cuisine}`);
    assert.equal(findCatalogDish(cover.name, cuisine), cover);
  }
  assert.equal(cuisineCovers.Other, undefined);
  assert.equal(findCatalogDish("Unknown custom dish", "Other"), undefined);
});

test("every imported dish photo is registered as a bundled local asset", () => {
  const manifestUrl = new URL(
    "../src/features/food-dex/data/catalogImages.ts",
    import.meta.url,
  );
  const manifest = readFileSync(manifestUrl, "utf8");
  const directory = dirname(fileURLToPath(manifestUrl));
  const entries = [
    ...manifest.matchAll(
      /("(?:\\.|[^"\\])*"):\s*require\(("(?:\\.|[^"\\])*")\)/g,
    ),
  ];
  const assets = new Map(
    entries.map((match) => [JSON.parse(match[1]), JSON.parse(match[2])]),
  );
  assert.ok(dishes.length >= 256);
  assert.equal(
    assets.size,
    dishes.filter((dish) => dish.image?.localPath).length,
  );
  for (const dish of dishes) {
    const asset = assets.get(dish.id);
    assert.ok(asset, `Missing bundled photo for ${dish.name}`);
    assert.ok(existsSync(resolve(directory, asset)), asset);
  }
});
