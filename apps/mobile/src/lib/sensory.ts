import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";
import {
  playGameFeedback,
  prepareGameFeedback,
  stopGameFeedback,
  type GameFeedbackName,
} from "./gameFeedback";

export type SoundName =
  | "interfaceClick"
  | "openBook"
  | "alert"
  | "bell"
  | "menuOpen"
  | "menuClose"
  | "select"
  | "reward"
  | "chest"
  | "sparkle"
  | "save"
  | "remove"
  | "click"
  | "success"
  | "discover"
  | "levelup"
  | "scan"
  | "error"
  | "badge"
  | "tap";

const soundFiles: Record<SoundName, number> = {
  interfaceClick: require("../../../../assets/interfaceclick.mp3"),
  openBook: require("../../../../assets/openbook.mp3"),
  alert: require("../../../../assets/alert.mp3"),
  bell: require("../../../../assets/bell ding.mp3"),
  menuOpen: require("../../assets/sfx/kenney/open_001.wav"),
  menuClose: require("../../assets/sfx/kenney/close_001.wav"),
  select: require("../../assets/sfx/kenney/select_001.wav"),
  reward: require("../../assets/sfx/reward.wav"),
  chest: require("../../assets/sfx/chest.wav"),
  sparkle: require("../../assets/sfx/sparkle.wav"),
  save: require("../../assets/sfx/kenney/confirmation_001.wav"),
  remove: require("../../assets/sfx/kenney/back_001.wav"),
  click: require("../../assets/sfx/kenney/click_001.wav"),
  success: require("../../assets/sfx/kenney/confirmation_002.wav"),
  discover: require("../../assets/sfx/discover.wav"),
  levelup: require("../../assets/sfx/levelup.wav"),
  scan: require("../../assets/sfx/kenney/question_001.wav"),
  error: require("../../assets/sfx/kenney/error_001.wav"),
  badge: require("../../assets/sfx/badge.wav"),
  tap: require("../../assets/sfx/kenney/tick_001.wav"),
};

const cache = new Map<SoundName, AudioPlayer>();
const lastPlayed = new Map<SoundName, number>();
const requests = new Map<SoundName, number>();
let soundRequests = 0;
let rewardUntil = 0;
let activeRewardRank = 0;
let playbackEpoch = 0;
const rewardDurations: Partial<Record<SoundName, number>> = {
  reward: 640,
  chest: 760,
  sparkle: 430,
  badge: 490,
  levelup: 730,
  discover: 530,
  success: 540,
};
const rewardRanks: Partial<Record<SoundName, number>> = {
  success: 1,
  discover: 2,
  sparkle: 2,
  reward: 3,
  chest: 3,
  badge: 4,
  levelup: 5,
};

// Existing handlers can supply a more specific cue without getting a second click.
export function withButtonFeedback(
  action: () => void,
  sound: SoundName = "click",
) {
  const before = soundRequests;
  action();
  if (soundRequests === before) void playFeedback(sound);
}

AppState.addEventListener("change", (state) => {
  if (state === "active") {
    prepareFeedback();
    return;
  }
  playbackEpoch += 1;
  stopGameFeedback();
  for (const player of cache.values()) player.remove();
  cache.clear();
  lastPlayed.clear();
  rewardUntil = 0;
  activeRewardRank = 0;
});

export async function playFeedback(name: SoundName) {
  soundRequests += 1;
  try {
    if (AppState.currentState && AppState.currentState !== "active") return;
    const now = Date.now();
    const rewardDuration = rewardDurations[name];
    const rank = rewardRanks[name] ?? 0;
    // Let celebrations finish; avoid stacking clicks when nested controls fire.
    if (now < rewardUntil && rank < activeRewardRank) return;
    if (now - (lastPlayed.get(name) ?? -Infinity) < 60) return;
    lastPlayed.set(name, now);
    if (rewardDuration) {
      // A level-up or badge replaces the smaller reward instead of layering it.
      playbackEpoch += 1;
      stopGameFeedback();
      for (const player of cache.values()) player.pause();
      rewardUntil = now + rewardDuration;
      activeRewardRank = rank;
    }
    if (isGameFeedback(name)) {
      const duration = playGameFeedback(name);
      if (duration !== false) {
        if (rewardDuration) rewardUntil = now + duration;
        return;
      }
      if (name === "scan") hapticMedium();
      else hapticSuccess();
    } else {
      switch (name) {
        case "select":
          hapticSelection();
          break;
        case "openBook":
        case "bell":
        case "success":
          hapticSuccess();
          break;
        case "error":
          hapticError();
          break;
        default:
          hapticLight();
      }
    }
    const request = (requests.get(name) ?? 0) + 1;
    const epoch = playbackEpoch;
    requests.set(name, request);
    if (!cache.has(name)) {
      cache.set(name, createAudioPlayer(soundFiles[name]));
    }
    const player = cache.get(name)!;
    if (player.isLoaded) await player.seekTo(0);
    // A background transition may have removed this player during seek.
    if (
      cache.get(name) !== player ||
      requests.get(name) !== request ||
      playbackEpoch !== epoch
    )
      return;
    player.volume = rewardDuration
      ? 0.4
      : name === "click" || name === "select"
        ? 0.18
        : 0.28;
    player.play();
  } catch {
    // Ignore audio failures; visuals/haptics still work.
  }
}

/** Prepare native players after mounting; web playback starts in a user gesture. */
export function prepareFeedback() {
  prepareGameFeedback();
  void setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: "mixWithOthers",
  }).catch(() => {});
  if (Platform.OS === "web") return;
  for (const name of Object.keys(soundFiles) as SoundName[]) {
    if (cache.has(name)) continue;
    try {
      cache.set(name, createAudioPlayer(soundFiles[name]));
    } catch {
      // Retry lazily on interaction if preloading is unavailable.
    }
  }
}

function isGameFeedback(name: SoundName): name is GameFeedbackName {
  return [
    "reward",
    "chest",
    "sparkle",
    "badge",
    "levelup",
    "discover",
    "scan",
  ].includes(name);
}

function runHaptic(
  effect: () => Promise<void>,
  android: Haptics.AndroidHaptics,
) {
  if (AppState.currentState && AppState.currentState !== "active") return;
  try {
    const result =
      Platform.OS === "android"
        ? Haptics.performAndroidHapticsAsync(android)
        : effect();
    void result.catch(() => {});
  } catch {
    // Unsupported devices/browsers still receive the visual and sound feedback.
  }
}

export function hapticLight() {
  runHaptic(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
    Haptics.AndroidHaptics.Virtual_Key,
  );
}

export function hapticMedium() {
  runHaptic(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
    Haptics.AndroidHaptics.Context_Click,
  );
}

export function hapticHeavy() {
  runHaptic(
    () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
    Haptics.AndroidHaptics.Long_Press,
  );
}

export function hapticSuccess() {
  runHaptic(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
    Haptics.AndroidHaptics.Confirm,
  );
}

export function hapticError() {
  runHaptic(
    () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    Haptics.AndroidHaptics.Reject,
  );
}

export function hapticSelection() {
  runHaptic(
    () => Haptics.selectionAsync(),
    Haptics.AndroidHaptics.Segment_Tick,
  );
}
