import assert from "node:assert/strict";
import { test } from "node:test";
import {
  containMenuBox,
  menuDiscovery,
  sampleMenu,
} from "../src/features/menu-lens/models/menuLens.ts";
import {
  parseMenuBox,
  parseMenuDishes,
} from "../../../packages/food-catalog/src/menuLens.ts";
const entry = (name, cuisine) => ({
  id: name,
  name,
  cuisine,
  photo: "",
  discoveredAt: new Date().toISOString(),
});
test("anchors account for portrait and landscape letterboxing", () => {
  const box = { x: 0.1, y: 0.2, width: 0.5, height: 0.1 };
  assert.deepEqual(
    containMenuBox(
      box,
      { width: 100, height: 200 },
      { width: 400, height: 400 },
    ),
    { x: 120, y: 80, width: 100, height: 40 },
  );
  assert.deepEqual(
    containMenuBox(
      box,
      { width: 200, height: 100 },
      { width: 400, height: 400 },
    ),
    { x: 40, y: 140, width: 200, height: 20 },
  );
  assert.equal(
    containMenuBox(box, { width: 0, height: 0 }, { width: 400, height: 400 }),
    null,
  );
});
test("invalid anchors preserve readable results; malformed dishes fail closed", () => {
  for (const box of [
    null,
    {},
    { x: -1, y: 0, width: 1, height: 1 },
    { x: 0.9, y: 0, width: 0.4, height: 0.1 },
    { x: NaN, y: 0, width: 1, height: 1 },
  ])
    assert.equal(parseMenuBox(box), null);
  assert.equal(
    parseMenuDishes([{ ...sampleMenu[0], box: { x: -10 } }])[0].box,
    null,
  );
  assert.throws(() =>
    parseMenuDishes([{ ...sampleMenu[0], dietaryFlags: ["SAFE"] }]),
  );
  assert.throws(() => parseMenuDishes(Array(25).fill(sampleMenu[0])));
});
test("canonical collection and dietary flags coexist", () => {
  const result = menuDiscovery(
    sampleMenu[0],
    [entry("Pizza", "Italian")],
    "Vegan",
  );
  assert.equal(result.collected, true);
  assert.equal(result.rare, false);
  assert.deepEqual(result.conflicts, ["dairy"]);
});
test("rare finds use cuisine history and diet-specific conflicts", () => {
  assert.equal(menuDiscovery(sampleMenu[1], [], "Vegetarian").rare, true);
  assert.deepEqual(menuDiscovery(sampleMenu[1], [], "Vegetarian").conflicts, [
    "fish",
  ]);
  assert.deepEqual(
    menuDiscovery(sampleMenu[1], [], "Pescatarian").conflicts,
    [],
  );
  assert.deepEqual(menuDiscovery(sampleMenu[2], [], "Pescatarian").conflicts, [
    "meat",
  ]);
  assert.deepEqual(
    menuDiscovery(sampleMenu[2], [], "No preference").conflicts,
    [],
  );
  assert.equal(
    menuDiscovery(
      sampleMenu[1],
      [entry("Green curry", "Thai"), entry("Tom yum", "Thai")],
      "No preference",
    ).rare,
    false,
  );
  assert.equal(
    menuDiscovery(
      { ...sampleMenu[1], cuisine: "Other", catalogId: null },
      [],
      "No preference",
    ).rare,
    false,
  );
});

test("sample cards resolve to actual catalog entries", () => {
  for (const dish of sampleMenu)
    assert.ok(menuDiscovery(dish, [], "No preference").catalog);
});
