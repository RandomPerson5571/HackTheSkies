import { TurboModuleRegistry } from "react-native";
import type { GameFeedbackName } from "./gameFeedback";

type PulsarSDK = typeof import("react-native-pulsar");
let sdk: PulsarSDK | null | undefined;

function getPulsar(): PulsarSDK | null {
  if (sdk !== undefined) return sdk;
  try {
    // Expo Go and development clients built before Pulsar was installed use Expo.
    if (!TurboModuleRegistry.get("RNPulsar")) return (sdk = null);
    const pulsar: PulsarSDK = require("react-native-pulsar");
    pulsar.Settings.enableSound(true);
    pulsar.Settings.enableCache(true);
    pulsar.Settings.preloadPresets([
      "CoinDrop",
      "Unfurl",
      "Pip",
      "Fanfare",
      "Ascent",
      "Sonar",
      "CameraShutter",
    ]);
    sdk = pulsar;
  } catch {
    sdk = null;
  }
  return sdk;
}

export function prepareGameFeedback() {
  getPulsar();
}

export function stopGameFeedback() {
  try {
    sdk?.Settings.stopHaptics();
  } catch {
    // Feedback must never prevent an interaction or background transition.
  }
}

export function playGameFeedback(name: GameFeedbackName): number | false {
  const pulsar = getPulsar();
  if (!pulsar) return false;
  try {
    const presets = {
      reward: pulsar.Presets.coinDrop,
      chest: pulsar.Presets.unfurl,
      sparkle: pulsar.Presets.pip,
      badge: pulsar.Presets.fanfare,
      levelup: pulsar.Presets.ascent,
      discover: pulsar.Presets.sonar,
      scan: pulsar.Presets.cameraShutter,
    };
    presets[name]();
    // Durations of the 1.7 presets, so quieter feedback waits for the full phrase.
    return {
      reward: 675,
      chest: 1180,
      sparkle: 100,
      badge: 580,
      levelup: 2400,
      discover: 2000,
      scan: 150,
    }[name];
  } catch {
    return false;
  }
}
