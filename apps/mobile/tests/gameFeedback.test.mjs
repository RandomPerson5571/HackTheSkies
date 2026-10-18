import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(
  new URL("../src/lib/gameFeedback.native.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup({ available = true, fail = false } = {}) {
  const calls = [];
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require: (name) => {
      if (name === "react-native")
        return { TurboModuleRegistry: { get: () => (available ? {} : null) } };
      assert.equal(name, "react-native-pulsar");
      calls.push("load");
      if (fail) throw new Error("Native module unavailable");
      return {
        Settings: {
          enableSound: (value) => calls.push(["sound", value]),
          enableCache: (value) => calls.push(["cache", value]),
          preloadPresets: (names) => calls.push(["preload", ...names]),
          stopHaptics: () => calls.push("stop"),
        },
        Presets: Object.fromEntries(
          [
            "coinDrop",
            "unfurl",
            "pip",
            "fanfare",
            "ascent",
            "sonar",
            "cameraShutter",
          ].map((preset) => [preset, () => calls.push(preset)]),
        ),
      };
    },
  });
  return { ...exports, calls };
}

test("native rewards play distinct Pulsar presets with generated sound enabled", () => {
  const feedback = setup();
  feedback.prepareGameFeedback();
  for (const event of [
    "reward",
    "chest",
    "sparkle",
    "badge",
    "levelup",
    "discover",
    "scan",
  ]) {
    assert.ok(feedback.playGameFeedback(event) > 0);
  }
  assert.deepEqual(feedback.calls.slice(0, 3), [
    "load",
    ["sound", true],
    ["cache", true],
  ]);
  assert.deepEqual(feedback.calls.slice(4), [
    "coinDrop",
    "unfurl",
    "pip",
    "fanfare",
    "ascent",
    "sonar",
    "cameraShutter",
  ]);
  assert.equal(feedback.calls.filter((call) => call === "load").length, 1);
  feedback.stopGameFeedback();
  assert.deepEqual(feedback.calls.slice(-2), ["stop", ["sound", false]]);
  feedback.playGameFeedback("levelup");
  assert.deepEqual(feedback.calls.slice(-2), [["sound", true], "ascent"]);
});

test("Expo Go never imports the unavailable native Pulsar SDK", () => {
  const feedback = setup({ available: false });
  feedback.prepareGameFeedback();
  assert.equal(feedback.playGameFeedback("chest"), false);
  feedback.stopGameFeedback();
  assert.deepEqual(feedback.calls, []);
});

test("a broken native SDK fails safely and is not reloaded on every press", () => {
  const feedback = setup({ fail: true });
  assert.equal(feedback.playGameFeedback("badge"), false);
  assert.equal(feedback.playGameFeedback("levelup"), false);
  assert.deepEqual(feedback.calls, ["load"]);
});
