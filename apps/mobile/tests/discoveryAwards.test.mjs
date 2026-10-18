import test from "node:test";
import assert from "node:assert/strict";
import {
  discoveryAwards,
  restaurantQuestAwards,
} from "../src/features/gamification/models/discoveryAwards.ts";
const entry = (name, id = name) => ({
  id,
  name,
  cuisine: "Japanese",
  photo: "meal.jpg",
  discoveredAt: "2026-10-18T12:00:00Z",
});
test("first collection earns a quest award with its XP", () => {
  const awards = discoveryAwards([], [entry("Ramen")], "Ramen", 50);
  assert.equal(awards.length, 1);
  assert.equal(awards[0].kind, "quest");
  assert.equal(awards[0].xp, 50);
});
test("set reward precedes the level-up and includes collection XP", () => {
  const before = [entry("Ramen"), entry("Sushi"), entry("Tempura")];
  const awards = discoveryAwards(
    before,
    [...before, entry("Okonomiyaki")],
    "Okonomiyaki",
    200,
  );
  assert.deepEqual(
    awards.map((award) => award.kind),
    ["quest", "level"],
  );
  assert.equal(awards[0].xp, 200);
  assert.equal(awards[1].title, "Level 3");
});
test("normal discovery can level up without completing a quest", () => {
  const before = [entry("Ramen"), entry("Sushi")];
  const awards = discoveryAwards(
    before,
    [...before, entry("Tempura")],
    "Tempura",
    150,
  );
  assert.deepEqual(
    awards.map((award) => award.kind),
    ["level"],
  );
});
test("restoring or revisiting a collection does not replay awards", () => {
  const entries = [entry("Ramen")];
  assert.deepEqual(discoveryAwards(entries, entries, "Ramen", 200), []);
  assert.deepEqual(discoveryAwards([], [], "missing", 200), []);
});

test("third unique restaurant triggers completion and repeat visits do not", () => {
  const awards = restaurantQuestAwards(["a", "b"], ["a", "b", "c"], [], 100);
  assert.deepEqual(
    awards.map((award) => award.kind),
    ["quest", "level"],
  );
  assert.equal(awards[0].xp, 150);
  assert.deepEqual(
    restaurantQuestAwards(["a", "b", "c"], ["a", "b", "c"], [], 100),
    [],
  );
});
