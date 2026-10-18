import assert from "node:assert/strict";
import { test } from "node:test";
import {
  restaurantCandidates,
  MAX_RESTAURANT_CANDIDATES,
} from "../src/services/restaurant-candidates.ts";

test("restaurant prompts remain bounded and prefer cuisines implied by a dish", () => {
  const candidates = restaurantCandidates("Japanese noodles and ramen");
  assert.ok(candidates.length <= MAX_RESTAURANT_CANDIDATES);
  assert.ok(JSON.stringify(candidates).length < 10000);
  assert.equal(candidates[0].cuisine, "Japanese");
  assert.equal(
    new Set(candidates.map((place) => place.id)).size,
    candidates.length,
  );
  assert.equal(restaurantCandidates("pho")[0].cuisine, "Vietnamese");
});
