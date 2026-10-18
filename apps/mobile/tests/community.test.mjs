import assert from "node:assert/strict";
import test from "node:test";
import {
  badgeProgress,
  calculatePoints,
  cuisineBadges,
  sampleFriends,
} from "../src/features/community/models/community.ts";
import { places } from "../src/features/restaurants/data/places.ts";

test("badges count distinct visited places in their own category", () => {
  // Test category behavior independently of the imported restaurant catalog.
  const fixtures = [
    ["test-bakery", "Bakery"],
    ["test-bread", "Bakery"],
    ["test-ramen", "Ramen"],
    ["test-coffee", "Coffee"],
    ["test-espresso", "Coffee"],
    ["test-pizza", "Pizza"],
  ].map(([id, category]) => ({ ...places[0], id, category }));
  assert.equal(
    badgeProgress(
      "Bakery",
      ["test-bakery", "test-bakery", "test-ramen"],
      fixtures,
    ),
    1,
  );
  assert.equal(
    badgeProgress("Bakery", ["test-bakery", "test-bread"], fixtures),
    2,
  );
  assert.equal(badgeProgress("Ramen", [], fixtures), 0);
  for (const badge of cuisineBadges) {
    assert.ok(
      badgeProgress(
        badge.category,
        fixtures.map((place) => place.id),
        fixtures,
      ) >= badge.goal,
    );
  }
});

test("points count valid unique visits and earned badge bonuses", () => {
  const fixtures = [
    ["test-bakery", "Bakery"],
    ["test-bread", "Bakery"],
    ["test-ramen", "Ramen"],
    ["test-coffee", "Coffee"],
    ["test-espresso", "Coffee"],
    ["test-pizza", "Pizza"],
  ].map(([id, category]) => ({ ...places[0], id, category }));

  assert.equal(calculatePoints([], fixtures), 0);
  assert.equal(
    calculatePoints(
      ["test-bakery", "test-bread", "test-ramen", "test-ramen", "unknown"],
      fixtures,
    ),
    130,
  );
});

test("every sample friend visit links to an existing restaurant", () => {
  for (const friend of sampleFriends) {
    for (const visit of friend.visits) {
      assert.ok(places.some((place) => place.id === visit.placeId));
      assert.ok(visit.rating >= 1 && visit.rating <= 5);
    }
  }
});
