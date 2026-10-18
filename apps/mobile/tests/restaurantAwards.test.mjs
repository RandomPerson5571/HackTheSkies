import test from "node:test";
import assert from "node:assert/strict";
import { restaurantQuestAwards } from "../src/features/gamification/models/discoveryAwards.ts";

test("restaurant quest completion queues its reward before a level-up", () => {
  const awards = restaurantQuestAwards(["a", "b"], ["a", "b", "c"], [], 100);
  assert.deepEqual(awards.map((award) => award.kind), ["quest", "level"]);
  assert.equal(awards[0].xp, 150);
  assert.equal(awards[1].title, "Level 2");
});

test("revisiting a completed restaurant quest does not replay its celebration", () => {
  assert.deepEqual(restaurantQuestAwards(["a", "b", "c"], ["a", "b", "c", "c"], [], 100), []);
});
