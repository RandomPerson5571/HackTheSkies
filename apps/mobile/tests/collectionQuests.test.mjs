import assert from "node:assert/strict";
import test from "node:test";
import {
  collectionQuests,
  collectionQuestProgress,
  advancedCollectionQuests,
} from "../src/features/quests/models/collectionQuests.ts";
const quest = (id) => collectionQuests.find((q) => q.id === id);
const entry = (name, cuisine = "Japanese", id = name) => ({
  id,
  name,
  cuisine,
  photo: "file://food.jpg",
  discoveredAt: "2026-10-18T12:00:00Z",
});
test("one discovery advances every matching mission", () => {
  const advanced = advancedCollectionQuests([], [entry("Ramen")]).map(
    (q) => q.id,
  );
  assert.deepEqual(
    advanced.sort(),
    [
      "five-finds",
      "full-album",
      "daily-discoveries",
      "first-Japanese",
      "ramen-run",
      "around-the-world",
      "table-Japanese",
    ].sort(),
  );
});
test("duplicates and unrelated foods do not fill ramen slots", () => {
  const entries = [
    entry("Miso Ramen"),
    entry(" miso ramen ", "Japanese", "duplicate"),
    entry("Shoyu Ramen"),
    entry("Pizza", "Italian"),
    entry("Ramen", "Chinese"),
  ];
  assert.equal(collectionQuestProgress(quest("ramen-run"), entries).count, 2);
  assert.equal(
    collectionQuestProgress(quest("ramen-run"), [
      ...entries,
      entry("Tonkotsu Ramen"),
    ]).complete,
    true,
  );
});
test("world mission counts unique cuisines and caps progress", () => {
  const entries = [
    entry("Ramen"),
    entry("Sushi"),
    entry("Pizza", "Italian"),
    entry("Pho", "Vietnamese"),
    entry("Dosa", "South Asian"),
    entry("Crepe", "French"),
    entry("Dumplings", "Chinese"),
  ];
  assert.equal(
    collectionQuestProgress(quest("around-the-world"), entries).count,
    5,
  );
});
test("sets accept any order, require each dish and restore from saved entries", () => {
  const entries = [
    entry("Okonomiyaki"),
    entry("Sushi"),
    entry("Tempura"),
    entry("Ramen"),
  ];
  assert.equal(
    collectionQuestProgress(
      quest("table-Japanese"),
      JSON.parse(JSON.stringify(entries)),
    ).complete,
    true,
  );
  assert.equal(
    collectionQuestProgress(quest("table-Japanese"), entries.slice(1)).complete,
    false,
  );
  assert.deepEqual(
    advancedCollectionQuests(entries, [...entries, entry("Ramen")]),
    [],
  );
});
test("dessert collection requires distinct Italian desserts", () => {
  assert.equal(
    collectionQuestProgress(quest("sweet-finish"), [
      entry("Tiramisu", "Italian"),
      entry("Gelato", "Italian"),
      entry("Pizza", "Italian"),
    ]).complete,
    true,
  );
  assert.equal(
    collectionQuestProgress(quest("sweet-finish"), [
      entry("Tiramisu", "Japanese"),
    ]).count,
    0,
  );
});

test("restaurant quests count distinct visited places without food entries", () => {
  assert.equal(
    collectionQuestProgress(quest("new-tables"), [], ["a", "a", "b"]).count,
    2,
  );
  assert.equal(
    collectionQuestProgress(quest("new-tables"), [], ["a", "b", "c"]).complete,
    true,
  );
  assert.equal(
    collectionQuestProgress(quest("city-taster"), [], ["a", "b", "c"]).complete,
    false,
  );
});
test("home cooking requires an explicit home location", () => {
  const entries = [
    { ...entry("Ramen"), location: "Home kitchen" },
    { ...entry("Sushi"), location: "home" },
    { ...entry("Tempura"), location: "My kitchen" },
    { ...entry("Pizza", "Italian"), location: "Home Slice Pizza" },
  ];
  assert.equal(collectionQuestProgress(quest("home-chef"), entries).count, 3);
  assert.equal(
    collectionQuestProgress(quest("home-chef"), [entries[3]]).count,
    0,
  );
});
test("daily discoveries count separate dates, not dishes in one day", () => {
  const entries = [
    entry("Ramen"),
    entry("Sushi"),
    { ...entry("Tempura"), discoveredAt: "2026-10-19T12:00:00Z" },
    { ...entry("Pizza", "Italian"), discoveredAt: "2026-10-20T12:00:00Z" },
  ];
  assert.equal(
    collectionQuestProgress(quest("daily-discoveries"), entries).complete,
    true,
  );
  assert.equal(
    collectionQuestProgress(quest("daily-discoveries"), entries.slice(0, 2))
      .count,
    1,
  );
});
