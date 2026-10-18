import assert from "node:assert/strict";
import test from "node:test";
import { places } from "../src/features/restaurants/data/places.ts";
import {
  emptyCollection,
  updateCollection,
  parseCollection,
} from "../src/features/restaurants/models/restaurantCollection.ts";
import {
  buildRecommendations,
  getMapMarkerPlaces,
  rarityLabel,
  rarityPolicy,
  rarityScore,
  recommendationLabel,
  recommendationPolicy,
  scoreRestaurant,
} from "../src/features/restaurants/models/recommendations.ts";

const restaurant = (id, averageRating, reviewCount) => ({
  ...places[0],
  id,
  ratingSummary:
    averageRating === undefined ? undefined : { averageRating, reviewCount },
});

test("quality weighs more than familiarity, while equally good niche spots rank higher", () => {
  assert.ok(
    recommendationPolicy.qualityWeight > recommendationPolicy.nicheWeight,
  );
  assert.ok(scoreRestaurant(4.8, 15) > scoreRestaurant(4.2, 15));
  assert.ok(scoreRestaurant(4.8, 15) > scoreRestaurant(4.8, 1500));
  assert.ok(scoreRestaurant(5, 10_000) > scoreRestaurant(1, 1));
  assert.ok(scoreRestaurant(5, 10_000) >= 0);
  assert.ok(scoreRestaurant(5, 1) <= 100);
});

test("unrated, invalid and poorly rated restaurants do not get suggested for being obscure", () => {
  for (const [average, count] of [
    [NaN, 5],
    [6, 3],
    [4.5, 0],
    [4.5, -1],
    [4.5, 1.5],
  ]) {
    assert.equal(scoreRestaurant(average, count), 0);
  }
  const data = [
    restaurant("unrated"),
    restaurant("poor", 2, 1),
    restaurant("gem", 4.8, 12),
    restaurant("famous", 4.8, 10_000),
  ];
  const ratings = buildRecommendations(data, {});
  assert.equal(ratings.get("unrated").averageRating, null);
  assert.equal(ratings.get("unrated").score, 0);
  assert.equal(ratings.get("unrated").suggested, false);
  assert.equal(ratings.get("poor").suggested, false);
  assert.equal(ratings.get("gem").suggested, true);
  assert.equal(ratings.get("famous").suggested, false);
});

test("a local rating updates a count-weighted community average and survives storage round trips", () => {
  const data = [restaurant("real-place", 4, 9)];
  const state = updateCollection(emptyCollection, {
    type: "rate",
    placeId: "real-place",
    rating: 5,
  });
  const stored = parseCollection(JSON.stringify(state), ["real-place"]);
  const rating = buildRecommendations(data, stored.ratings).get("real-place");
  assert.equal(rating.averageRating, 4.1);
  assert.equal(rating.reviewCount, 10);
  const edited = updateCollection(stored, {
    type: "rate",
    placeId: "real-place",
    rating: 1,
  });
  assert.equal(
    buildRecommendations(data, edited.ratings).get("real-place").reviewCount,
    10,
  );
  assert.equal(
    buildRecommendations(data, edited.ratings).get("real-place").averageRating,
    3.7,
  );
  assert.equal(
    buildRecommendations(data, edited.ratings).get("real-place").suggested,
    false,
  );
  const cleared = updateCollection(edited, {
    type: "rate",
    placeId: "real-place",
    rating: 0,
  });
  assert.equal(
    buildRecommendations(data, cleared.ratings).get("real-place").reviewCount,
    9,
  );
});

test("imported restaurants have no seeded ratings", () => {
  const ratings = buildRecommendations(places, {});
  for (const place of places) {
    assert.ok(place.id.startsWith("csv-"));
    assert.equal(ratings.get(place.id).reviewCount, 0);
    assert.equal(ratings.get(place.id).suggested, false);
    assert.equal(recommendationLabel(ratings.get(place.id)), "Not rated yet");
  }
});

test("rating an unrated restaurant promotes it; downgrading or clearing removes photo eligibility", () => {
  const data = [restaurant("new-place")];
  const high = buildRecommendations(data, { "new-place": 5 });
  assert.equal(high.get("new-place").suggested, true);
  for (const votes of [{ "new-place": 2 }, {}, { "new-place": NaN }]) {
    assert.equal(
      buildRecommendations(data, votes).get("new-place").suggested,
      false,
    );
  }
});

test("map photos increase with zoom while staying viewport-only and prioritizing suggestions", () => {
  const data = Array.from({ length: 10 }, (_, i) =>
    restaurant(`place-${i}`, 4.8, i + 1),
  );
  data.push(
    ...Array.from({ length: 20 }, (_, i) => restaurant(`unrated-${i}`)),
  );
  data.push(restaurant("offscreen", 5, 1), restaurant("selected-unrated"));
  const visible = new Set(data.slice(0, 20).map((place) => place.id));
  const ratings = buildRecommendations(data, {});
  const markers = getMapMarkerPlaces(data, visible, ratings);
  assert.equal(markers.length, 20);
  assert.equal(markers[0].id, "place-0");
  assert.ok(markers.every((place) => visible.has(place.id)));
  const zoomed = getMapMarkerPlaces(data, visible, ratings, undefined, 13);
  assert.equal(zoomed.length, 20);
  assert.ok(
    zoomed.slice(0, 10).every((place) => ratings.get(place.id).suggested),
  );
  assert.ok(
    zoomed.slice(10).every((place) => !ratings.get(place.id).suggested),
  );
  const selected = getMapMarkerPlaces(
    data,
    visible,
    ratings,
    "selected-unrated",
  );
  assert.equal(selected[0].id, "selected-unrated");
  assert.equal(selected.length, 21);
  assert.equal(ratings.get(selected[0].id).suggested, false);
  const selectedPhoto = getMapMarkerPlaces(data, visible, ratings, "place-0");
  assert.equal(
    selectedPhoto.filter((place) => place.id === "place-0").length,
    1,
  );
  assert.deepEqual(getMapMarkerPlaces([], visible, ratings, "place-0"), []);
});

test("rarity weighs rating 60% and nicheness 40%, out of 5", () => {
  assert.equal(rarityPolicy.ratingWeight, 0.6);
  assert.equal(rarityPolicy.nicheWeight, 0.4);
  assert.ok(rarityScore(4.8, 40) > rarityScore(4.8, 2000));
  assert.ok(rarityScore(4.8, 300) > rarityScore(3.8, 300));
  assert.equal(rarityScore(5, rarityPolicy.popularityCeiling), 3);
  assert.ok(rarityScore(5, 1) <= 5 && rarityScore(1, 1_000_000) >= 0);
  for (const [average, count] of [[NaN, 5], [6, 3], [4.5, 0], [4.5, 1.5]])
    assert.equal(rarityScore(average, count), null);
  assert.equal(rarityLabel({ value: 3.2, estimated: false }), "Rarity 3.2/5");
  assert.equal(rarityLabel(undefined), "Rarity unknown");
});

test("every imported restaurant has a rarity, estimated when it has under 10 public ratings", () => {
  for (const place of places) {
    assert.ok(place.rarity, place.name);
    assert.ok(place.rarity.value >= 0 && place.rarity.value <= 5, place.name);
    assert.equal(
      place.rarity.estimated,
      (place.ratingCount ?? 0) < rarityPolicy.minimumRatings,
    );
  }
});
