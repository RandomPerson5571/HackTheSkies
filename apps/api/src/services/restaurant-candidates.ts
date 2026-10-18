import restaurants from "../../../mobile/src/features/restaurants/data/importedRestaurants.json" with { type: "json" };

export const MAX_RESTAURANT_CANDIDATES = 32;
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const cuisineHints = [
  [/ramen|sushi|tempura|udon|sashimi/i, "japanese"],
  [/pizza|pasta|risotto|carbonara/i, "italian"],
  [/pho|banh mi/i, "vietnamese"],
  [/kimchi|bibimbap|bulgogi/i, "korean"],
  [/tacos|burrito/i, "mexican"],
] as const;

// Bound prompt size before inference; the full directory exceeds provider limits.
export function restaurantCandidates(prompt: string) {
  const query = normalize(prompt);
  const words =
    query.match(/[\p{L}\p{N}]+/gu)?.filter((word) => word.length > 2) ?? [];
  const hints = cuisineHints
    .filter(([pattern]) => pattern.test(query))
    .map(([, cuisine]) => cuisine);
  return restaurants
    .map((place, index) => {
      const text = normalize(
        `${place.restaurant_name} ${place.cuisine} ${place.neighbourhood} ${place.address}`,
      );
      const cuisine = normalize(place.cuisine);
      const score =
        words.reduce(
          (sum, word) =>
            sum +
            (text.includes(word) ? 1 : 0) +
            (cuisine.includes(word) ? 3 : 0),
          0,
        ) + (hints.some((hint) => cuisine.includes(hint)) ? 4 : 0);
      return { place, index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_RESTAURANT_CANDIDATES)
    .map(({ place }) => ({
      id: place.id,
      name: place.restaurant_name,
      cuisine: place.cuisine,
      neighborhood: place.neighbourhood,
    }));
}
