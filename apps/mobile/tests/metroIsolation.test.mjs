import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const { resolver, watchFolders } = require("../metro.config.cjs");
const blocked = (relative) =>
  resolver.blockList.some((pattern) =>
    pattern.test(
      fileURLToPath(new URL(relative, new URL("../", import.meta.url))),
    ),
  );

test("Metro excludes API code and credentials while allowing app and shared assets", () => {
  for (const file of [
    ".env",
    ".env.local",
    ".env.server.local",
    "server/index.ts",
    "server/routes/food-scan.ts",
    "scripts/dev.mjs",
    "../api/src/index.ts",
    "../api/.dev.vars",
  ])
    assert.equal(blocked(file), true, file);
  for (const file of ["index.ts", "src/app/App.tsx", "assets/icon.png"])
    assert.equal(blocked(file), false, file);
  assert.equal(blocked("../../packages/food-catalog/src/cuisines.ts"), false);
  assert.equal(blocked("../../packages/map-restaurants/index.ts"), false);
  assert.ok(watchFolders.includes(fileURLToPath(new URL("../../../packages/map-restaurants", import.meta.url))));
});
