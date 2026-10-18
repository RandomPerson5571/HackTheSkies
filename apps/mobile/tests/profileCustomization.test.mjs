import assert from "node:assert/strict";
import test from "node:test";
import { parseProfile } from "../src/features/profile/models/profile.ts";
import {
  ranks,
  parseCustomization,
  rankForXp,
  resolveCustomization,
} from "../src/features/profile/models/customization.ts";

test("existing profiles get safe defaults and customizations survive a save/load round trip", () => {
  const original = {
    name: "Alex",
    neighborhood: "Toronto",
    diet: "Vegetarian",
  };
  assert.deepEqual(parseProfile(original).customization, {
    frame: "auto",
    banner: "garden",
    palette: "matcha",
    featuredBadge: "auto",
  });
  const custom = {
    ...original,
    customization: {
      frame: "artisan",
      banner: "market",
      palette: "ube",
      featuredBadge: "foodie",
    },
  };
  assert.deepEqual(parseProfile(JSON.parse(JSON.stringify(custom))), custom);
  assert.equal(
    parseProfile({
      ...original,
      customization: { palette: "peach", frame: "invented" },
    }).customization.frame,
    "auto",
  );
  assert.throws(
    () => parseProfile({ ...original, name: "" }),
    /Invalid profile/,
  );
});

test("rank decorations unlock exactly at each XP boundary", () => {
  for (let index = 0; index < ranks.length; index++) {
    const rank = ranks[index];
    const threshold = (rank.level - 1) * 200;
    assert.equal(rankForXp(threshold).id, rank.id);
    if (index) assert.equal(rankForXp(threshold - 1).id, ranks[index - 1].id);
    assert.equal(
      resolveCustomization(undefined, threshold, new Set()).frame,
      rank.id,
    );
  }
  assert.equal(rankForXp(Infinity).id, "sprout");
  assert.equal(rankForXp(-100).id, "sprout");
});

test("restored locked cosmetics and unearned trophies cannot be equipped", () => {
  const appearance = resolveCustomization(
    {
      frame: "master",
      banner: "market",
      featuredBadge: "gourmet",
      palette: "peach",
    },
    0,
    new Set(["first-bite"]),
  );
  assert.equal(appearance.frame, "sprout");
  assert.equal(appearance.banner, "garden");
  assert.equal(appearance.featuredBadge, "first-bite");
  assert.equal(appearance.palette.id, "peach");
  assert.equal(appearance.selected.frame, "auto");
  assert.equal(appearance.selected.banner, "garden");
  assert.equal(appearance.selected.featuredBadge, "auto");
  const earned = resolveCustomization(
    { frame: "artisan", banner: "market", featuredBadge: "foodie" },
    3800,
    new Set(["first-bite", "foodie"]),
  );
  assert.equal(earned.frame, "artisan");
  assert.equal(earned.banner, "market");
  assert.equal(earned.featuredBadge, "foodie");
  assert.equal(earned.nextRank, undefined);
});

test("explicit opt-outs stay off after leveling up, and invalid preferences are discarded", () => {
  const appearance = resolveCustomization(
    { frame: "none", featuredBadge: "none" },
    5000,
    new Set(["gourmet"]),
  );
  assert.equal(appearance.frame, null);
  assert.equal(appearance.featuredBadge, null);
  assert.equal(
    resolveCustomization(undefined, 0, new Set()).featuredBadge,
    null,
  );
  assert.deepEqual(
    parseCustomization({
      frame: {},
      banner: "remote.svg",
      palette: 2,
      featuredBadge: "unknown",
    }),
    parseCustomization(null),
  );
});
