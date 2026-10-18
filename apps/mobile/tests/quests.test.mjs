import assert from "node:assert/strict";
import test from "node:test";
import {
  allQuests,
  bonusCount,
  bonusExpired,
  chapters,
  claimBonus,
  completeQuest,
  hasDish,
  initialQuests,
  parseQuests,
  pathCuisines,
  pathDishes,
  pathProgress,
  questsFor,
  questStatus,
} from "../src/features/quests/models/quests.ts";

test("three catalog-backed paths contain four five-step chapters and seven templates", () => {
  assert.equal(allQuests.length, 60);
  assert.equal(new Set(allQuests.map((q) => q.id)).size, 60);
  assert.equal(new Set(allQuests.map((q) => q.type)).size, 7);
  for (const cuisine of pathCuisines) {
    const path = questsFor(cuisine);
    for (let chapter = 0; chapter < chapters.length; chapter++) {
      assert.equal(path.filter((q) => q.chapter === chapter).length, 5);
      assert.equal(path[chapter * 5 + 4].type, "boss");
    }
    for (const dish of pathDishes(cuisine)) assert.equal(dish.cuisine, cuisine);
  }
});

test("prerequisites and duplicate completions cannot award XP or skip chapters", () => {
  let state = initialQuests();
  const path = questsFor("Japanese");
  assert.equal(questStatus(state, path[0]), "current");
  assert.equal(completeQuest(state, path[4]), state);
  state = completeQuest(state, path[0]);
  assert.equal(questStatus(state, path[1]), "current");
  assert.equal(completeQuest(state, path[0]), state);
  assert.equal(pathProgress(state, "Japanese").xp, 25);
  assert.equal(pathProgress(state, "Italian").xp, 0);
});

test("bosses stamp the passport, unlock the next chapter and survive cuisine switching", () => {
  let state = initialQuests();
  const path = questsFor("Korean");
  for (const quest of path) state = completeQuest(state, quest);
  state.selectedCuisine = "Italian";
  const restored = parseQuests(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.selectedCuisine, "Italian");
  assert.deepEqual(pathProgress(restored, "Korean"), {
    count: 20,
    total: 20,
    xp: 1040,
    level: 6,
    levelXp: 40,
    stamps: 4,
  });
  assert.equal(pathProgress(restored, "Italian").stamps, 0);
});

test("hydration drops unknown IDs, skipped prerequisites and invalid personalized quests", () => {
  const state = parseQuests({
    selectedCuisine: "invented",
    completed: [
      "japanese-0-0",
      "japanese-0-0",
      "japanese-0-4",
      "fake",
      "personalized-Japanese",
    ],
    personalized: {
      Japanese: { dishId: "fake", reason: "hi", template: "learn" },
    },
    bonusXp: -50,
  });
  assert.deepEqual(state.completed, ["japanese-0-0"]);
  assert.equal(state.selectedCuisine, "Japanese");
  assert.equal(state.bonusXp, 0);
  assert.deepEqual(state.personalized, {});
});

test("food discovery matching is normalized and requires the catalog cuisine", () => {
  const entry = {
    id: "1",
    name: " RＡＭＥＮ ",
    cuisine: "Japanese",
    photo: "",
    discoveredAt: new Date().toISOString(),
  };
  assert.equal(hasDish([entry], "ramen"), true);
  assert.equal(hasDish([{ ...entry, cuisine: "Italian" }], "ramen"), false);
  assert.equal(hasDish([entry], "fake"), false);
});

test("bonus check-ins count unique restaurants, neighbourhoods and cuisines", () => {
  const visits = [
    { id: "1", cuisine: "Italian", neighborhood: "Annex" },
    { id: "1", cuisine: "Italian", neighborhood: "Annex" },
    { id: "2", cuisine: "Japanese", neighborhood: "Annex" },
  ];
  const run = { startedAt: "2026-10-17T12:00:00Z", visits, claimed: false };
  assert.equal(bonusCount("new-restaurants", run), 2);
  assert.equal(bonusCount("neighbourhood-explorer", run), 1);
  assert.equal(bonusCount("cuisine-collector", run), 2);
});

test("bonus XP is claimed once, requires the target, and rejects expired adventures", () => {
  const now = Date.parse("2026-10-17T12:00:00Z");
  let state = initialQuests();
  state.bonus["new-restaurants"] = {
    startedAt: new Date(now).toISOString(),
    visits: [],
    claimed: false,
  };
  assert.equal(claimBonus(state, "new-restaurants", now), state);
  state.bonus["new-restaurants"].visits = [1, 2, 3].map((id) => ({
    id: String(id),
    cuisine: "Japanese",
    neighborhood: "Annex",
  }));
  assert.equal(claimBonus(state, "new-restaurants", now + 7 * 86400000), state);
  assert.equal(
    bonusExpired(
      "new-restaurants",
      state.bonus["new-restaurants"],
      now + 7 * 86400000,
    ),
    true,
  );
  state = claimBonus(state, "new-restaurants", now);
  assert.equal(state.bonusXp, 100);
  assert.equal(claimBonus(state, "new-restaurants", now), state);
  assert.equal(parseQuests(state).bonusXp, 100);
});
