import assert from "node:assert/strict";
import { test } from "node:test";
import { migrateWebBookmarks } from "../src/lib/migrateWebBookmarks.ts";
import { emptyCollection } from "../src/features/restaurants/models/restaurantCollection.ts";
function store(entries) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    async getItem(key) {
      return values.get(key) ?? null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}
test("web bookmarks merge into the journal once, preserving ratings, visits and lists", async () => {
  const existing = {
    ...emptyCollection,
    saved: ["a"],
    visited: ["a"],
    ratings: { a: 5 },
    favorites: ["a"],
    lists: [{ id: "dinner", name: "Dinner", placeIds: ["a"] }],
  };
  const storage = store({
    "cibo:web:saved-restaurants": '["a","b","b","unknown"]',
    "cibo.cloud.collection": JSON.stringify({ value: existing, dirty: false }),
  });
  await migrateWebBookmarks(storage, ["a", "b"]);
  const migrated = JSON.parse(await storage.getItem("cibo.cloud.collection"));
  assert.deepEqual(migrated.value, { ...existing, saved: ["a", "b"] });
  assert.equal(migrated.dirty, true);
  await storage.setItem(
    "cibo.cloud.collection",
    JSON.stringify({ value: emptyCollection, dirty: true }),
  );
  await migrateWebBookmarks(storage, ["a", "b"]);
  assert.deepEqual(
    JSON.parse(await storage.getItem("cibo.cloud.collection")).value.saved,
    [],
  );
});
test("failed migrations preserve original bookmarks and retry safely", async () => {
  const storage = store({ "cibo:web:saved-restaurants": '["a"]' });
  await assert.rejects(
    migrateWebBookmarks(
      {
        ...storage,
        async setItem() {
          throw new Error("Storage full");
        },
      },
      ["a"],
    ),
  );
  assert.equal(await storage.getItem("cibo:web:saved-restaurants"), '["a"]');
  assert.equal(await storage.getItem("cibo.webBookmarksImported"), null);
  await migrateWebBookmarks(storage, ["a"]);
  assert.deepEqual(
    JSON.parse(await storage.getItem("cibo.cloud.collection")).value.saved,
    ["a"],
  );
});
