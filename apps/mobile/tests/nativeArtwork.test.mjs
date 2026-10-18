import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createRequire } from "node:module";
import test from "node:test";
import {
  frames,
  trophies,
} from "../src/features/profile/components/rewardSources.native.ts";
import { ranks } from "../src/features/profile/models/customization.ts";
import { BADGES } from "../src/features/gamification/models/gamification.ts";

const require = createRequire(import.meta.url);
const expoRequire = createRequire(require.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const sharp = cliRequire("sharp");

test("every reward and avatar frame has a decodable native image without a server request", async () => {
  for (const badge of BADGES) assert.ok(trophies[badge.id], badge.id);
  for (const rank of ranks) assert.ok(frames[rank.id], rank.id);
  const images = new Map(
    Object.entries({ ...trophies, ...frames }).map(([id, source]) => [
      source.uri,
      { id, source },
    ]),
  );
  for (const { id, source } of images.values()) {
    assert.match(source.uri, /^data:image\/png;base64,/, id);
    const bytes = Buffer.from(source.uri.split(",")[1], "base64");
    const image = sharp(bytes);
    const metadata = await image.metadata();
    assert.equal(metadata.format, "png", id);
    assert.equal(metadata.width, source.width * source.scale, id);
    assert.equal(metadata.height, source.height * source.scale, id);
    const { channels } = await image.stats();
    // Artwork must have visible pixels and keep its transparent background.
    assert.equal(channels[3].min, 0, id);
    assert.equal(channels[3].max, 255, id);
  }
});
