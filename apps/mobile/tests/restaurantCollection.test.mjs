import assert from "node:assert/strict";
import test from "node:test";
import {
  emptyCollection,
  parseCollection,
  updateCollection,
} from "../src/restaurantCollection.ts";

test("adding a restaurant to a custom list saves it once and preserves other memberships", () => {
  const original = structuredClone(emptyCollection);
  let state = updateCollection(emptyCollection, {
    type: "create-list",
    id: "brunch",
    name: "Brunch",
  });
  state = updateCollection(state, {
    type: "create-list",
    id: "weekend",
    name: "Weekend",
  });
  state = updateCollection(state, {
    type: "membership",
    listId: "brunch",
    placeId: "coffee",
  });
  state = updateCollection(state, {
    type: "membership",
    listId: "weekend",
    placeId: "coffee",
  });
  state = updateCollection(state, {
    type: "membership",
    listId: "brunch",
    placeId: "coffee",
  });
  assert.deepEqual(state.saved, ["coffee"]);
  assert.deepEqual(
    state.lists.map((list) => list.placeIds),
    [[], ["coffee"]],
  );
  assert.deepEqual(emptyCollection, original);
});

test("visited restaurants stay saved when marked as not visited", () => {
  let state = updateCollection(emptyCollection, {
    type: "visit",
    placeId: "pizza",
  });
  assert.deepEqual(state.saved, ["pizza"]);
  assert.deepEqual(state.visited, ["pizza"]);
  state = updateCollection(state, { type: "visit", placeId: "pizza" });
  assert.deepEqual(state.saved, ["pizza"]);
  assert.deepEqual(state.visited, []);
});

test("removing a saved restaurant cleans up visited status and all lists", () => {
  let state = updateCollection(emptyCollection, {
    type: "create-list",
    id: "dinner",
    name: "Dinner",
  });
  state = updateCollection(state, {
    type: "membership",
    listId: "dinner",
    placeId: "pizza",
  });
  state = updateCollection(state, { type: "visit", placeId: "pizza" });
  state = updateCollection(state, { type: "save", placeId: "pizza" });
  assert.deepEqual(state, {
    ...emptyCollection,
    saved: [],
    visited: [],
    lists: [{ id: "dinner", name: "Dinner", placeIds: [] }],
  });
});

test("list names are trimmed and empty or duplicate names are rejected", () => {
  const state = updateCollection(emptyCollection, {
    type: "create-list",
    id: "first",
    name: "  Date night  ",
  });
  assert.equal(state.lists[0].name, "Date night");
  assert.equal(
    updateCollection(state, {
      type: "create-list",
      id: "second",
      name: "date NIGHT",
    }),
    state,
  );
  assert.equal(
    updateCollection(state, { type: "create-list", id: "empty", name: "   " }),
    state,
  );
  assert.equal(
    updateCollection(state, {
      type: "membership",
      listId: "missing",
      placeId: "pizza",
    }),
    state,
  );
});

test("stored collections round-trip while stale restaurant IDs are removed", () => {
  const state = {
    saved: ["coffee", "pizza", "old"],
    visited: ["pizza"],
    lists: [{ id: "weekend", name: "Weekend", placeIds: ["coffee", "old"] }],
  };
  const restored = parseCollection(JSON.stringify(state), ["coffee", "pizza"]);
  assert.deepEqual(restored, {
    ...emptyCollection,
    saved: ["coffee", "pizza"],
    visited: ["pizza"],
    lists: [{ id: "weekend", name: "Weekend", placeIds: ["coffee"] }],
  });
  assert.deepEqual(
    parseCollection(JSON.stringify(restored), ["coffee", "pizza"]),
    restored,
  );
});

test("corrupt persisted data is rejected instead of silently becoming empty lists", () => {
  for (const value of [
    "broken json",
    "null",
    "{}",
    JSON.stringify({ saved: [], visited: [], lists: [null] }),
  ]) {
    assert.throws(() => parseCollection(value, ["coffee"]));
  }
});

test("ratings save visits and rankings move independently of stars", () => {
  let state = updateCollection(emptyCollection, {
    type: "rate",
    placeId: "pizza",
    rating: 5,
  });
  state = updateCollection(state, {
    type: "rate",
    placeId: "ramen",
    rating: 3,
  });
  state = updateCollection(state, {
    type: "rank",
    placeId: "ramen",
    direction: -1,
  });
  assert.deepEqual(state.favorites, ["ramen", "pizza"]);
  assert.deepEqual(state.visited, ["pizza", "ramen"]);
  assert.deepEqual(state.saved, ["pizza", "ramen"]);
  assert.equal(state.ratings.ramen, 3);
  assert.equal(
    updateCollection(state, { type: "rank", placeId: "ramen", direction: -1 }),
    state,
  );
  for (const rating of [-1, 6, 2.5, NaN]) {
    assert.equal(
      updateCollection(state, { type: "rate", placeId: "pizza", rating }),
      state,
    );
  }
  assert.deepEqual(
    parseCollection(JSON.stringify(state), ["pizza", "ramen"]),
    state,
  );
});

test("clearing ratings preserves visits while unvisiting removes ratings", () => {
  const rated = updateCollection(emptyCollection, {
    type: "rate",
    placeId: "pizza",
    rating: 4,
  });
  const cleared = updateCollection(rated, {
    type: "rate",
    placeId: "pizza",
    rating: 0,
  });
  assert.deepEqual(cleared.favorites, []);
  assert.deepEqual(cleared.ratings, {});
  assert.deepEqual(cleared.visited, ["pizza"]);
  const unvisited = updateCollection(rated, {
    type: "visit",
    placeId: "pizza",
  });
  assert.deepEqual(unvisited.favorites, []);
  assert.deepEqual(unvisited.ratings, {});
  assert.deepEqual(unvisited.saved, ["pizza"]);
  const unsaved = updateCollection(rated, { type: "save", placeId: "pizza" });
  assert.deepEqual(unsaved, emptyCollection);
});

test("friend additions persist and can be removed without changing visits", () => {
  const added = updateCollection(emptyCollection, {
    type: "friend",
    friendId: "maya",
  });
  assert.deepEqual(parseCollection(JSON.stringify(added), []).friendIds, [
    "maya",
  ]);
  assert.deepEqual(
    updateCollection(added, { type: "friend", friendId: "maya" }),
    emptyCollection,
  );
});

test("restore rejects invalid ratings and repairs duplicate or stale rankings", () => {
  const restored = parseCollection(
    JSON.stringify({
      ...emptyCollection,
      saved: ["pizza", "ramen"],
      visited: ["pizza", "ramen"],
      ratings: { pizza: 4, ramen: 10, stale: 5 },
      favorites: ["stale", "pizza", "pizza", "ramen"],
    }),
    ["pizza", "ramen"],
  );
  assert.deepEqual(restored.ratings, { pizza: 4 });
  assert.deepEqual(restored.favorites, ["pizza"]);
});
