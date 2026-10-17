import assert from "node:assert/strict";
import { test } from "node:test";
import {
  browseRestaurants,
  surpriseCuisine,
} from "../src/features/restaurants/models/restaurantBrowse.ts";
const places = [
  {
    id: "b",
    name: "Zebra Ramen",
    cuisine: "Japanese",
    category: "Ramen",
    neighborhood: "Downtown",
    address: "1 King St",
  },
  {
    id: "a",
    name: "Alpha Ramen",
    cuisine: "Japanese",
    category: "Ramen",
    neighborhood: "Midtown",
    address: "2 King St",
  },
  {
    id: "c",
    name: "Pizza Place",
    cuisine: "Italian",
    category: "Pizza",
    neighborhood: "Downtown",
    address: "3 Queen St",
  },
];
const defaults = {
  query: "",
  category: "All",
  cuisine: "All",
  sort: "discovery",
};
test("cuisine, category and search work together without reordering source data", () => {
  assert.deepEqual(
    browseRestaurants(
      places,
      { ...defaults, cuisine: "Japanese", query: " KING ", sort: "name" },
      new Map(),
    ).map((p) => p.id),
    ["a", "b"],
  );
  assert.deepEqual(
    browseRestaurants(
      places,
      { ...defaults, cuisine: "Italian", category: "Ramen" },
      new Map(),
    ),
    [],
  );
  assert.deepEqual(
    places.map((p) => p.id),
    ["b", "a", "c"],
  );
});
test("discovery preserves recommendation ordering and Surprise me changes cuisine", () => {
  assert.equal(
    browseRestaurants(places, defaults, new Map([["c", { score: 99 }]]))[0].id,
    "c",
  );
  assert.equal(
    surpriseCuisine(["All", "Italian", "Japanese"], "Italian", () => 0),
    "Japanese",
  );
  assert.equal(surpriseCuisine(["All", "Italian"], "Italian"), "Italian");
});
