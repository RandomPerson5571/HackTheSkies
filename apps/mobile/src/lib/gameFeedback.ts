export type GameFeedbackName =
  "reward" | "chest" | "sparkle" | "badge" | "levelup" | "discover" | "scan";

// Metro selects gameFeedback.native.ts on iOS/Android. Browsers use Expo + WAVs.
export function prepareGameFeedback(): void {}
export function stopGameFeedback(): void {}
export function playGameFeedback(_name: GameFeedbackName): number | false {
  return false;
}
