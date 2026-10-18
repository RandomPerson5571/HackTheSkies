import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { setImmediate } from "node:timers";
import { runInNewContext } from "node:vm";

const require = createRequire(new URL("../package.json", import.meta.url));
const ts = require("typescript");
const source = readFileSync(
  new URL("../src/lib/sensory.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function setup({
  seek = async () => {},
  platform = "web",
  game = false,
  hapticFailure = false,
} = {}) {
  let now = 10_000;
  let onStateChange;
  const players = [];
  const haptics = [];
  const games = [];
  let gameStops = 0;
  const record = (kind, value) => {
    haptics.push([kind, value]);
    return hapticFailure
      ? Promise.reject(new Error("Haptics unavailable"))
      : Promise.resolve();
  };
  const appState = {
    currentState: "active",
    addEventListener: (_event, listener) => {
      onStateChange = listener;
    },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    Date: class extends Date {
      static now() {
        return now;
      }
    },
    require: (name) => {
      if (name.endsWith(".wav")) return name;
      if (name === "./gameFeedback")
        return {
          prepareGameFeedback() {},
          stopGameFeedback() {
            gameStops++;
          },
          playGameFeedback(name) {
            if (!game) return false;
            games.push(name);
            return 2400;
          },
        };
      if (name === "expo-haptics")
        return {
          ImpactFeedbackStyle: {
            Light: "light",
            Medium: "medium",
            Heavy: "heavy",
          },
          NotificationFeedbackType: { Success: "success", Error: "error" },
          AndroidHaptics: {
            Virtual_Key: "virtual-key",
            Context_Click: "context-click",
            Long_Press: "long-press",
            Confirm: "confirm",
            Reject: "reject",
            Segment_Tick: "segment-tick",
          },
          impactAsync: (style) => record("impact", style),
          notificationAsync: (kind) => record("notification", kind),
          selectionAsync: () => record("selection", "selection"),
          performAndroidHapticsAsync: (kind) => record("android", kind),
        };
      if (name === "react-native")
        return { AppState: appState, Platform: { OS: platform } };
      if (name === "expo-audio")
        return {
          setAudioModeAsync: async () => {},
          createAudioPlayer: (asset) => {
            const player = {
              asset,
              isLoaded: true,
              plays: 0,
              pauses: 0,
              removed: false,
              seekTo: seek,
              play() {
                assert.equal(this.removed, false);
                this.plays++;
              },
              pause() {
                this.pauses++;
              },
              remove() {
                this.removed = true;
              },
            };
            players.push(player);
            return player;
          },
        };
      throw new Error(`Unexpected dependency ${name}`);
    },
  });
  return {
    ...exports,
    players,
    haptics,
    games,
    get gameStops() {
      return gameStops;
    },
    advance: (ms) => {
      now += ms;
    },
    changeState: (state) => {
      appState.currentState = state;
      onStateChange(state);
    },
  };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("button feedback supplies a click and preserves a handler's specific cue", async () => {
  const sounds = setup();
  sounds.withButtonFeedback(() => {});
  await flush();
  sounds.advance(100);
  sounds.withButtonFeedback(() => {
    void sounds.playFeedback("save");
  });
  await flush();
  assert.equal(sounds.players.length, 2);
  assert.match(sounds.players[0].asset, /click_001.wav$/);
  assert.match(sounds.players[1].asset, /confirmation_001.wav$/);
  assert.deepEqual(
    sounds.players.map((p) => p.plays),
    [1, 1],
  );
});

test("level-up replaces a smaller reward and keeps clicks from drowning it out", async () => {
  const sounds = setup();
  await sounds.playFeedback("success");
  await sounds.playFeedback("levelup");
  await sounds.playFeedback("click");
  await sounds.playFeedback("discover");
  assert.equal(sounds.players.length, 2);
  assert.equal(sounds.players[0].pauses, 1);
  assert.match(sounds.players[1].asset, /levelup.wav$/);
  sounds.advance(1600);
  await sounds.playFeedback("click");
  assert.equal(sounds.players.at(-1).plays, 1);
  assert.match(sounds.players.at(-1).asset, /click_001.wav$/);
});

test("backgrounding during a seek releases players without playing a stale instance", async () => {
  let resume;
  const sounds = setup({
    seek: () =>
      new Promise((resolve) => {
        resume = resolve;
      }),
  });
  const pending = sounds.playFeedback("click");
  sounds.changeState("background");
  resume();
  await pending;
  assert.equal(sounds.players[0].removed, true);
  assert.equal(sounds.players[0].plays, 0);
  await sounds.playFeedback("menuOpen");
  assert.equal(sounds.players.length, 1);
  sounds.changeState("active");
  const next = sounds.playFeedback("click");
  resume();
  await next;
  assert.equal(sounds.players.length, 2);
  assert.equal(sounds.players[1].plays, 1);
});

test("rapid duplicate presses produce a single cue", async () => {
  const sounds = setup();
  await Promise.all([
    sounds.playFeedback("select"),
    sounds.playFeedback("select"),
  ]);
  assert.equal(sounds.players.length, 1);
  assert.equal(sounds.players[0].plays, 1);
  sounds.advance(80);
  await sounds.playFeedback("select");
  assert.equal(sounds.players[0].plays, 2);
});

test("every registered sound is a nonempty WAV asset", () => {
  for (const [, asset] of source.matchAll(/require\("(.*?\.wav)"\)/g)) {
    const buffer = readFileSync(
      new URL(asset, new URL("../src/lib/sensory.ts", import.meta.url)),
    );
    assert.equal(buffer.toString("ascii", 0, 4), "RIFF", asset);
    assert.equal(buffer.toString("ascii", 8, 12), "WAVE", asset);
    assert.ok(buffer.length > 1000, asset);
  }
});

test("a pending smaller reward cannot resume over a newer level-up", async () => {
  const sounds = setup();
  await Promise.all([
    sounds.playFeedback("success"),
    sounds.playFeedback("levelup"),
  ]);
  assert.equal(sounds.players[0].plays, 0);
  assert.equal(sounds.players[1].plays, 1);
});

test("basic Android feedback uses the device haptics engine", async () => {
  const feedback = setup({ platform: "android" });
  await feedback.playFeedback("select");
  feedback.advance(100);
  await feedback.playFeedback("click");
  feedback.advance(100);
  await feedback.playFeedback("success");
  assert.deepEqual(feedback.haptics, [
    ["android", "segment-tick"],
    ["android", "virtual-key"],
    ["android", "confirm"],
  ]);
});

test("iOS and browser basic effects reach Expo Haptics", async () => {
  for (const platform of ["ios", "web"]) {
    const feedback = setup({ platform });
    await feedback.playFeedback("click");
    await feedback.playFeedback("select");
    assert.deepEqual(feedback.haptics, [
      ["impact", "light"],
      ["selection", "selection"],
    ]);
  }
});

test("game effects use Pulsar without duplicate Expo vibrations or WAV audio", async () => {
  const feedback = setup({ platform: "ios", game: true });
  await feedback.playFeedback("chest");
  assert.deepEqual(feedback.games, ["chest"]);
  assert.deepEqual(feedback.haptics, []);
  assert.deepEqual(feedback.players, []);
  feedback.changeState("background");
  assert.equal(feedback.gameStops, 2);
  await feedback.playFeedback("levelup");
  assert.deepEqual(feedback.games, ["chest"]);
});

test("missing Pulsar falls back to Expo and sound assets", async () => {
  const feedback = setup({ platform: "ios", game: false });
  await feedback.playFeedback("badge");
  assert.deepEqual(feedback.haptics, [["notification", "success"]]);
  assert.equal(feedback.players[0].plays, 1);
});

test("unavailable haptic hardware does not interrupt sound playback", async () => {
  const feedback = setup({ hapticFailure: true });
  await feedback.playFeedback("click");
  await flush();
  assert.equal(feedback.players[0].plays, 1);
});

test("Pulsar level-ups keep priority for the complete native phrase", async () => {
  const feedback = setup({ platform: "ios", game: true });
  await feedback.playFeedback("levelup");
  feedback.advance(1000);
  await feedback.playFeedback("click");
  assert.equal(feedback.players.length, 0);
  feedback.advance(1500);
  await feedback.playFeedback("click");
  assert.equal(feedback.players[0].plays, 1);
});
