import { normalizeCuisine, dishes } from "../models/foodDex.ts";
import { apiEndpoint } from "../../../lib/api.ts";
import type { Cuisine } from "../models/foodDex";
export type FoodRecognition = {
  name: string;
  cuisine: Cuisine;
  catalogId: string | null;
  // Estimated location of the dish in the photo that was scanned, normalized
  // 0-1000 as [left, top, right, bottom]. Estimated by the vision model, not
  // detected like a YOLO box; never a sentinel such as (0, 0).
  bbox?: [number, number, number, number];
  locationConfidence?: "high" | "medium";
};

// Estimates without solid confidence are not rendered as a box at all.
export const ESTIMATED_BOX_MIN_UNITS = 80;
function parseBbox(
  value: unknown,
): [number, number, number, number] | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 4 ||
    value.some((entry) => !Number.isFinite(entry))
  )
    return undefined;
  const [left, top, right, bottom] = value;
  const ordered =
    left! <= right! &&
    top! <= bottom! &&
    left! >= 0 &&
    top! >= 0 &&
    right! <= 1000 &&
    bottom! <= 1000;
  if (
    !ordered ||
    right! - left! < ESTIMATED_BOX_MIN_UNITS ||
    bottom! - top! < ESTIMATED_BOX_MIN_UNITS
  )
    return undefined;
  return [left!, top!, right!, bottom!];
}

export async function recognizeFood(
  base64: string,
  signal: AbortSignal,
): Promise<FoodRecognition | null> {
  const endpoint = apiEndpoint(
    "/api/food-scan",
    process.env.EXPO_PUBLIC_FOOD_SCAN_URL,
  );
  if (!endpoint)
    throw new Error(
      "Photo recognition isn’t connected yet. Choose the dish and cuisine below to add it yourself.",
    );
  if (base64.length > 8_000_000)
    throw new Error(
      "This photo is too large to scan. Try a smaller photo or enter the dish below.",
    );
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64 }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(
      "Couldn’t reach food recognition. Check your connection and the recognition server address, then retry.",
      { cause: error },
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "Recognition isn’t configured. You can still add this meal by hand."
        : response.status === 429
          ? "Recognition is busy. Wait a moment and retry, or enter the dish below."
          : "The photo couldn’t be identified. Try again or enter the dish below.",
    );
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("name" in result) ||
    !("cuisine" in result) ||
    typeof result.name !== "string" ||
    typeof result.cuisine !== "string"
  )
    return null;
  if ("foodDetected" in result && result.foodDetected === false) return null;
  const cuisine = normalizeCuisine(result.cuisine);
  if (!result.name.trim() || !cuisine) return null;
  const catalogId =
    "catalogId" in result &&
    typeof result.catalogId === "string" &&
    dishes.some(
      (dish) => dish.id === result.catalogId && dish.cuisine === cuisine,
    )
      ? result.catalogId
      : null;
  const locationConfidence =
    "locationConfidence" in result &&
    (result.locationConfidence === "high" ||
      result.locationConfidence === "medium")
      ? result.locationConfidence
      : undefined;
  return {
    name: result.name.trim().slice(0, 80),
    cuisine,
    catalogId,
    ...(locationConfidence
      ? {
          locationConfidence,
          bbox:
            "bbox" in result
              ? (parseBbox(result.bbox) ?? undefined)
              : undefined,
        }
      : {}),
  };
}
