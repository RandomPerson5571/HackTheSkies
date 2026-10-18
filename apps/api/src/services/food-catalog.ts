import { catalogDishes } from "../../../../packages/food-catalog/data/catalog.ts";
import type { Cuisine } from "../../../../packages/food-catalog/src/cuisines.ts";

export const MAX_FOOD_CANDIDATES = 12;
const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
const stopWords = new Set([
  "a",
  "an",
  "and",
  "the",
  "with",
  "of",
  "in",
  "on",
  "or",
  "is",
  "food",
  "dish",
  "meal",
  "possibly",
  "served",
  "visible",
]);
const tokens = (value: string) =>
  new Set(
    (normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [])
      .filter((word) => word.length > 1 && !stopWords.has(word))
      .map((word) =>
        word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word,
      ),
  );
const index = catalogDishes.map((dish) => ({
  dish,
  name: normalize(dish.name),
  nameTokens: tokens(dish.name),
  descriptionTokens: tokens(dish.note),
}));

// Exact canonical names can correct an uncertain cuisine observation. Otherwise
// retrieve within the observed cuisine, ranking names and descriptions.
// This shortlist is evidence for visual verification, never a badge decision.
export function retrieveFoodCandidates(
  cuisine: Cuisine,
  name: string,
  description: string,
) {
  const queryName = normalize(name.trim());
  const exact = index.filter((entry) => entry.name === queryName);
  const canonicalCuisines = new Set(exact.map(({ dish }) => dish.cuisine));
  const category =
    canonicalCuisines.size === 1 ? exact[0]!.dish.cuisine : cuisine;
  const nameTokens = tokens(name);
  const queryTokens = tokens(`${name} ${description}`);
  return index
    .filter(
      ({ dish }) =>
        dish.cuisine === category || dish.cuisineIds.includes(category),
    )
    .map((entry) => ({
      ...entry,
      score:
        (entry.name === queryName ? 100 : 0) +
        [...nameTokens].filter((word) => entry.nameTokens.has(word)).length *
          10 +
        [...queryTokens].filter((word) => entry.nameTokens.has(word)).length *
          3 +
        [...queryTokens].filter((word) => entry.descriptionTokens.has(word))
          .length,
    }))
    .sort((a, b) => b.score - a.score || a.dish.id.localeCompare(b.dish.id))
    .slice(0, MAX_FOOD_CANDIDATES)
    .map(({ dish }) => ({
      id: dish.id,
      name: dish.name,
      cuisine: dish.cuisine,
      description: dish.note.slice(0, 200),
    }));
}
