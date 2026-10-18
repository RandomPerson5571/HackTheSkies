import assert from "node:assert/strict";
import test from "node:test";
import {
  bonusCount,
  bonusExpired,
  claimBonus,
  initialQuests,
  parseQuests,
} from "../src/features/quests/models/quests.ts";

test("hydration preserves bonus progress and ignores removed journey data", () => {
  const state = parseQuests({
    completed: ["japanese-0-0"],
    selectedCuisine: "Japanese",
    personalized: { Japanese: { dishId: "ramen" } },
    bonusXp: 100,
  });
  assert.deepEqual(state, { bonus: {}, bonusXp: 100 });
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
