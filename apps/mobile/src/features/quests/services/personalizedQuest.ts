import { apiEndpoint } from "../../../lib/api.ts";
import {
  pathDishIds,
  type PathCuisine,
  type PersonalizedQuest,
} from "../models/quests";

export type QuestPreferences = {
  cuisine: PathCuisine;
  diet: string;
  neighborhood: string;
  budget: "home" | "flexible";
  collectedIds: string[];
};
export async function generateQuest(
  preferences: QuestPreferences,
  signal: AbortSignal,
): Promise<PersonalizedQuest> {
  const foodEndpoint = process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
  const endpoint =
    apiEndpoint(
      "/api/quest-personalization",
      process.env.EXPO_PUBLIC_QUEST_URL,
    ) ||
    (foodEndpoint
      ? new URL("/api/quest-personalization", foodEndpoint).toString()
      : "");
  if (!endpoint)
    throw new Error(
      "AI quests aren’t connected yet. You can keep playing every cuisine path.",
    );
  // Use the AbortController API supported by native React Native as well as web.
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 30_000);
  let response: Response;
  let value;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
      signal: controller.signal,
    });
    value = await response.json();
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error(
      controller.signal.aborted
        ? "The quest picker took too long. Please try again."
        : "Couldn’t reach the quest picker. Check your connection and retry.",
      { cause },
    );
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "AI quests aren’t configured yet. Every cuisine path is still ready to play."
        : response.status === 429
          ? "The quest picker is busy. Try again in a moment."
          : "Couldn’t create your quest. Please try again.",
    );
  if (
    !value ||
    !pathDishIds[preferences.cuisine].includes(value.dishId) ||
    typeof value.reason !== "string" ||
    !["learn", "discover"].includes(value.template)
  )
    throw new Error(
      "The quest picker returned an unavailable dish. Please try again.",
    );
  return {
    dishId: value.dishId,
    reason: value.reason.slice(0, 500),
    template: value.template,
    restaurantId:
      typeof value.restaurantId === "string" ? value.restaurantId : null,
  };
}
