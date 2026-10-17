import assert from "node:assert/strict";
import test from "node:test";
import {
  badgeProgress,
  cuisineBadges,
  sampleFriends,
} from "../src/features/community/models/community.ts";
import { places } from "../src/features/restaurants/data/places.ts";

test("badges count distinct visited places in their own category", () => {
  assert.equal(
    badgeProgress("Bakery", ["bakery", "bakery", "ramen"], places),
    1,
  );
  assert.equal(badgeProgress("Bakery", ["bakery", "bread"], places), 2);
  assert.equal(badgeProgress("Ramen", [], places), 0);
  for (const badge of cuisineBadges) {
    assert.ok(
      badgeProgress(
        badge.category,
        places.map((place) => place.id),
        places,
      ) >= badge.goal,
    );
  }
});

test("every sample friend visit links to an existing restaurant", () => {
  for (const friend of sampleFriends) {
    for (const visit of friend.visits) {
      assert.ok(places.some((place) => place.id === visit.placeId));
      assert.ok(visit.rating >= 1 && visit.rating <= 5);
    }
  }
});
