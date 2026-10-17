import assert from "node:assert/strict";
import test from "node:test";
import { places } from "../src/features/restaurants/data/places.ts";

test("every restaurant has a photo with a traceable source", () => {
  for (const place of places) {
    assert.ok(place.photo, place.name);
    assert.equal(place.image, place.photo.url);
    assert.match(place.image, /^https?:\/\//);
    assert.match(place.photo.sourceUrl, /^https?:\/\//);
    if (place.photo.kind === "illustration") {
      assert.ok(place.photo.dishName);
      assert.ok(place.photo.licenseUrl);
    }
  }
});

test("the three curated venue photos retain their individual license metadata", () => {
  for (const id of ["csv-89ec64d6b8aaeace", "csv-3a14b2c6a68751f0", "csv-108ebb2afac24955"]) {
    const place = places.find((place) => place.id === id);
    assert.ok(place.photo.photographer);
    assert.match(place.photo.licenseUrl, /^https:\/\/creativecommons.org\//);
    assert.notEqual(place.photo.kind, "illustration");
  }
});
