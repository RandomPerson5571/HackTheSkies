import assert from "node:assert/strict";
import test from "node:test";
import { places } from "../src/features/restaurants/data/places.ts";
import {
  emptyCollection,
  parseCollection,
  updateCollection,
} from "../src/features/restaurants/models/restaurantCollection.ts";
import {
  monthlyChallenges,
  newRegionPoints,
  pointsForVisit,
  regionFor,
  rewardsSummary,
  visitHistory,
  visitPoints,
} from "../src/features/rewards/models/rewards.ts";

const october = new Date(2026, 9, 15, 12);
const at = (month, day) => new Date(2026, month, day, 12).toISOString();
const visit = (state, placeId, when) =>
  updateCollection(state, { type: "visit", placeId, at: when });

test("every sample place belongs to a drawn region", () => {
  for (const place of places) {
    assert.ok(!regionFor(place.coordinate).id.startsWith("grid:"), place.id);
  }
  assert.equal(regionFor([-79.4004, 43.6547]).id, "kensington-chinatown");
  assert.equal(regionFor([-80, 44]).name, "Uncharted area");
  assert.equal(
    regionFor([-80.005, 44.005]).id,
    regionFor([-80.015, 44.015]).id,
  );
});

test("visits record when they happened and drop the date when undone", () => {
  let state = visit(emptyCollection, "pizza", at(9, 3));
  assert.deepEqual(state.visitedAt, { pizza: at(9, 3) });
  state = updateCollection(state, {
    type: "rate",
    placeId: "pizza",
    rating: 4,
    at: at(9, 9),
  });
  assert.deepEqual(state.visitedAt, { pizza: at(9, 3) });
  state = visit(state, "pizza");
  assert.deepEqual(state.visitedAt, {});
  state = updateCollection(state, {
    type: "rate",
    placeId: "ramen",
    rating: 5,
    at: at(9, 4),
  });
  assert.deepEqual(state.visitedAt, { ramen: at(9, 4) });
  state = updateCollection(state, { type: "save", placeId: "ramen" });
  assert.deepEqual(state.visitedAt, {});
});

test("only the first spot in each region earns the region bonus", () => {
  // coffee and ramen share Kensington & Chinatown; bakery is in Little Italy & Trinity.
  let state = visit(emptyCollection, "ramen", at(9, 5));
  state = visit(state, "coffee", at(9, 2));
  state = visit(state, "bakery", at(9, 7));
  const history = visitHistory(state, places);
  assert.deepEqual(
    history.map((item) => [item.place.id, item.newRegion]),
    [
      ["coffee", true],
      ["ramen", false],
      ["bakery", true],
    ],
  );
  assert.deepEqual(pointsForVisit(places[1], state, places), {
    points: visitPoints,
    newRegion: false,
    region: regionFor(places[1].coordinate),
  });
  assert.equal(
    pointsForVisit(
      places.find((p) => p.id === "bread"),
      state,
      places,
    ).points,
    visitPoints + newRegionPoints,
  );
  assert.equal(pointsForVisit(places[0], state, places), null);
});

test("monthly challenges count only visits from that month", () => {
  let state = visit(emptyCollection, "coffee", at(8, 20));
  state = visit(state, "ramen", at(9, 2));
  state = visit(state, "bakery", at(9, 6));
  state = visit(state, "espresso", at(9, 9));
  const challenges = Object.fromEntries(
    monthlyChallenges(visitHistory(state, places), "2026-10", places).map(
      (item) => [item.id, item.progress],
    ),
  );
  assert.equal(challenges.regular, 3);
  assert.equal(challenges["region-hopper"], 3);
  // Kensington was claimed in September, so only two regions are new in October.
  assert.equal(challenges["new-territory"], 2);
});

test("points total visits, region bonuses and completed challenges", () => {
  let state = visit(emptyCollection, "coffee", at(9, 1));
  state = visit(state, "ramen", at(9, 2));
  state = visit(state, "bakery", at(9, 3));
  const summary = rewardsSummary(state, places, october);
  const completed = summary.challenges
    .filter((item) => item.progress >= item.goal)
    .map((item) => item.id);
  // October 2026 features pizza, which these visits don't include.
  assert.deepEqual(completed, ["regular", "region-hopper", "new-territory"]);
  const expected = 3 * visitPoints + 2 * newRegionPoints + 50 + 75 + 100;
  assert.equal(summary.total, expected);
  assert.equal(summary.monthPoints, expected);
  assert.equal(summary.daysLeft, 17);
  assert.equal(summary.regions.filter((region) => region.discovered).length, 2);

  const undone = visit(state, "bakery");
  assert.ok(rewardsSummary(undone, places, october).total < summary.total);
});

test("older journals without visit dates keep points but skip challenges", () => {
  const legacy = parseCollection(
    JSON.stringify({ saved: ["coffee"], visited: ["coffee"], lists: [] }),
    places.map((place) => place.id),
  );
  assert.deepEqual(legacy.visitedAt, {});
  const summary = rewardsSummary(legacy, places, october);
  assert.equal(summary.total, visitPoints + newRegionPoints);
  assert.equal(summary.monthPoints, 0);

  const parsed = parseCollection(
    JSON.stringify({
      saved: ["coffee", "pizza"],
      visited: ["coffee"],
      lists: [],
      visitedAt: { coffee: at(9, 1), pizza: at(9, 1), ramen: "nope" },
    }),
    places.map((place) => place.id),
  );
  assert.deepEqual(parsed.visitedAt, { coffee: at(9, 1) });
});
