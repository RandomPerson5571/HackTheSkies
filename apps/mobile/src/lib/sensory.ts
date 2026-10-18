import { Audio } from "expo-av";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

type SoundName =
  | "click"
  | "success"
  | "discover"
  | "levelup"
  | "scan"
  | "error"
  | "badge"
  | "tap";

const soundFiles: Record<SoundName, any> = {
  click: require("../../assets/sfx/click.wav"),
  success: require("../../assets/sfx/success.wav"),
  discover: require("../../assets/sfx/discover.wav"),
  levelup: require("../../assets/sfx/levelup.wav"),
  scan: require("../../assets/sfx/scan.wav"),
  error: require("../../assets/sfx/error.wav"),
  badge: require("../../assets/sfx/badge.wav"),
  tap: require("../../assets/sfx/tap.wav"),
};

const cache = new Map<SoundName, Audio.Sound>();

export async function playSound(name: SoundName) {
  try {
    if (!cache.has(name)) {
      const { sound } = await Audio.Sound.createAsync(soundFiles[name], {
        shouldPlay: false,
      });
      cache.set(name, sound);
    }
    const sound = cache.get(name)!;
    await sound.setPositionAsync(0);
    await sound.playAsync();
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
