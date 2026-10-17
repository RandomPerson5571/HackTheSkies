export async function recognizeFood(
  base64: string,
  signal: AbortSignal,
): Promise<{ name: string; cuisine: string } | null> {
  const endpoint = process.env.EXPO_PUBLIC_FOOD_SCAN_URL;
  if (!endpoint)
    throw new Error(
      "Photo recognition isn’t connected yet. Choose the dish and cuisine below to add it yourself.",
    );
  if (base64.length > 8_000_000)
    throw new Error(
      "This photo is too large to scan. Try a smaller photo or enter the dish below.",
    );
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: base64 }),
    signal,
  });
  if (!response.ok)
    throw new Error(
      "The photo couldn’t be identified. Try again or enter the dish below.",
    );
  const result: unknown = await response.json();
  if (
    !result ||
    typeof result !== "object" ||
    !("name" in result) ||
    !("cuisine" in result)
  )
    return null;
  const { name, cuisine } = result;
  return typeof name === "string" && name.trim() && typeof cuisine === "string"
    ? { name: name.trim().slice(0, 80), cuisine }
    : null;
}
