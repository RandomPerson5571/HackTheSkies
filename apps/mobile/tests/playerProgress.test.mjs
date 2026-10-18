import test from "node:test";
import assert from "node:assert/strict";
import { playerProgress } from "../src/features/gamification/models/playerProgress.ts";
import {
  initialQuests,
  completeQuest,
  questsFor,
} from "../src/features/quests/models/quests.ts";

test("shared progress includes activity, existing quests and collection rewards", () => {
  const quests = completeQuest(initialQuests(), questsFor("Japanese")[0]);
  const entries = [
    {
      id: "ramen",
      name: "Ramen",
      cuisine: "Japanese",
      photo: "meal.jpg",
      discoveredAt: "2026-10-18T12:00:00Z",
    },
  ];
  const progress = playerProgress(150, quests, entries);
  assert.equal(progress.totalXp, 225);
  assert.equal(progress.level, 2);
  assert.deepEqual(progress.xp, { current: 25, needed: 200 });
});
test("rank artwork and title advance at profile thresholds", () => {
  const initial = initialQuests();
  assert.equal(playerProgress(799, initial, []).rank.name, "Fresh Sprout");
  const promoted = playerProgress(800, initial, []);
  assert.equal(promoted.level, 5);
  assert.equal(promoted.rank.id, "sous-chef");
  assert.equal(promoted.rank.name, "Sous Chef");
  assert.equal(promoted.xp.current, 0);
});

test("restaurant rewards are included in the shared profile and quest total", () => {
  const progress = playerProgress(100, initialQuests(), [], ["a", "b", "c"]);
  assert.equal(progress.totalXp, 250);
  assert.equal(progress.level, 2);
  assert.equal(progress.xp.current, 50);
});
