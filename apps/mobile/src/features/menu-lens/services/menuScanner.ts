import { parseMenuDishes } from "../../../../../../packages/food-catalog/src/menuLens.ts";

export async function scanMenu(image: string, signal: AbortSignal) {
  const foodEndpoint = process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
  const endpoint =
    process.env.EXPO_PUBLIC_MENU_SCAN_URL ||
    (foodEndpoint ? new URL("/api/menu-scan", foodEndpoint).toString() : "");
  if (!endpoint)
    throw new Error("Menu scanning isn’t connected yet. Try the sample menu.");
  if (image.length > 8_000_000)
    throw new Error("This menu photo is too large. Try a smaller photo.");
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image }),
      signal,
    });
  } catch (cause) {
    if (signal.aborted) throw cause;
    throw new Error(
      "Couldn’t reach the menu scanner. Check your connection and retry.",
      { cause },
    );
  }
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "Menu scanning isn’t configured. Try the sample menu."
        : response.status === 429
          ? "The scanner is busy. Wait a moment and retry."
          : "Couldn’t read this menu. Try a sharper, closer photo.",
    );
  return parseMenuDishes((await response.json()).dishes);
}
