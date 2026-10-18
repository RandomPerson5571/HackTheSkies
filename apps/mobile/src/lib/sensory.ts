import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";

type SoundName =
  | "click"
  | "success"
  | "discover"
  | "levelup"
  | "scan"
  | "error"
  | "badge"
  | "tap";

const soundFiles: Record<SoundName, number> = {
  click: require("../../assets/sfx/click.wav"),
  success: require("../../assets/sfx/success.wav"),
  discover: require("../../assets/sfx/discover.wav"),
  levelup: require("../../assets/sfx/levelup.wav"),
  scan: require("../../assets/sfx/scan.wav"),
  error: require("../../assets/sfx/error.wav"),
  badge: require("../../assets/sfx/badge.wav"),
  tap: require("../../assets/sfx/tap.wav"),
};

const cache = new Map<SoundName, AudioPlayer>();

AppState.addEventListener("change", (state) => {
  if (state === "active") return;
  for (const player of cache.values()) player.release();
  cache.clear();
});

export async function playSound(name: SoundName) {
  try {
    if (!cache.has(name)) {
      cache.set(name, createAudioPlayer(soundFiles[name]));
    }
    const player = cache.get(name)!;
    if (player.isLoaded) await player.seekTo(0);
    player.play();
  } catch {
    // Ignore audio failures; visuals/haptics still work.
  }
}

export function hapticLight() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticMedium() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

export function hapticHeavy() {
  if (Platform.OS === "web") return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

export function hapticSuccess() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

export function hapticError() {
  if (Platform.OS === "web") return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

export function hapticSelection() {
  if (Platform.OS === "web") return;
  void Haptics.selectionAsync();
}
