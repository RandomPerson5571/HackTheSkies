import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";

export type SoundName =
  | "click"
  | "interfaceClick"
  | "openBook"
  | "alert"
  | "bell"
  | "error"
  | "badge";

const soundFiles: Record<SoundName, number> = {
  click: require("../../assets/sfx/kenney/click_001.wav"),
  interfaceClick: require("../../../../assets/interfaceclick.mp3"),
  openBook: require("../../../../assets/openbook.mp3"),
  alert: require("../../../../assets/alert.mp3"),
  bell: require("../../../../assets/alert.mp3"),
  error: require("../../../../assets/error.mp3"),
  badge: require("../../../../assets/badge.mp3"),
};

const cache = new Map<SoundName, AudioPlayer>();
const lastPlayed = new Map<SoundName, number>();
const requests = new Map<SoundName, number>();
let soundRequests = 0;
let playbackEpoch = 0;

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
  for (const player of cache.values()) player.remove();
  cache.clear();
  lastPlayed.clear();
});

export async function playFeedback(name: SoundName) {
  soundRequests += 1;
  try {
    if (AppState.currentState && AppState.currentState !== "active") return;
    const now = Date.now();
    if (now - (lastPlayed.get(name) ?? -Infinity) < 60) return;
    lastPlayed.set(name, now);
    switch (name) {
      case "bell":
      case "badge":
      case "openBook":
        hapticSuccess();
        break;
      case "error":
        hapticError();
        break;
      case "alert":
        hapticMedium();
        break;
      default:
        hapticLight();
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
    player.volume = name === "click" ? 0.18 : 0.35;
    player.play();
  } catch {
    // Ignore audio failures; visuals/haptics still work.
  }
}

/** Prepare native players after mounting; web playback starts in a user gesture. */
export function prepareFeedback() {
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
