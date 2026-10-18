import {
  cuisines,
  normalizeCuisine,
} from "../../../../../../packages/food-catalog/src/cuisines.ts";
import { catalogDishes } from "../../../../../../packages/food-catalog/data/catalog.ts";
import type { Cuisine } from "../../../../../../packages/food-catalog/src/cuisines.ts";
import type { CatalogDish } from "../../../../../../packages/food-catalog/src/types.ts";

export {
  cuisines,
  cuisineRegions,
  normalizeCuisine,
} from "../../../../../../packages/food-catalog/src/cuisines.ts";
export type { Cuisine } from "../../../../../../packages/food-catalog/src/cuisines.ts";
export type FoodEntry = {
  id: string;
  name: string;
  cuisine: Cuisine;
  photo: string;
  discoveredAt: string;
  review?: string;
  location?: string;
};
export type Dish = CatalogDish;
export const dishes: Dish[] = catalogDishes;

export function dishNumber(dish: Pick<Dish, "id">) {
  const index = dishes.findIndex((item) => item.id === dish.id);
  return index < 0 ? null : index + 1;
}

export function findDishByNumber(value: unknown) {
  const raw = typeof value === "number" ? String(value) : value;
  if (typeof raw !== "string") return undefined;
  const match = raw.trim().match(/^#?0*(\d+)$/);
  if (!match) return undefined;
  const number = Number(match[1]);
  return Number.isSafeInteger(number) && number > 0
    ? dishes[number - 1]
    : undefined;
}

const coverIds: Partial<Record<Cuisine, string>> = {
  Chinese: "dumplings",
  Korean: "bibimbap",
  Japanese: "ramen",
  Vietnamese: "pho",
  Thai: "pad-thai",
  "South Asian": "biryani",
  Levant: "musakhan",
  Greek: "souvlaki",
  Persian: "ghormeh-sabzi",
  French: "duck-confit",
  Italian: "pizza",
  Latin: "tacos",
  Caribbean: "jerk-chicken",
  American: "barbecue-ribs",
};

export const cuisineCovers = Object.fromEntries(
  cuisines.map((cuisine) => [
    cuisine,
    dishes.find(
      (dish) => dish.cuisine === cuisine && dish.id === coverIds[cuisine],
    ) ?? dishes.find((dish) => dish.cuisine === cuisine && dish.image),
  ]),
) as Record<Cuisine, Dish | undefined>;

export function findCatalogDish(name: string, cuisine: Cuisine) {
  return dishes.find(
    (dish) => foodKey(dish.name, dish.cuisine) === foodKey(name, cuisine),
  );
}

export function foodKey(name: string, cuisine: Cuisine) {
  return `${cuisine}:${name.trim().normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ")}`;
}

export function addFood(entries: FoodEntry[], entry: FoodEntry): FoodEntry[] {
  if (
    !entry.name.trim() ||
    !cuisines.includes(entry.cuisine) ||
    entries.some(
      (item) =>
        foodKey(item.name, item.cuisine) === foodKey(entry.name, entry.cuisine),
    )
  )
    return entries;
  return [{ ...entry, name: entry.name.trim() }, ...entries];
}

export function parseFoodDex(raw: string): FoodEntry[] {
  const value: unknown = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error("Invalid food collection");
  const result: FoodEntry[] = [];
  for (const entry of value) {
    const cuisine = normalizeCuisine(entry?.cuisine);
  if (
    !entry ||
    typeof entry.id !== "string" ||
    typeof entry.name !== "string" ||
    !entry.name.trim() ||
    !cuisine ||
    typeof entry.photo !== "string" ||
    typeof entry.discoveredAt !== "string" ||
    Number.isNaN(Date.parse(entry.discoveredAt)) ||
    (entry.review !== undefined && typeof entry.review !== "string") ||
    (entry.location !== undefined && typeof entry.location !== "string")
  )
      throw new Error("Invalid food entry");
    if (
      !result.some(
        (item) =>
          item.id === entry.id ||
          foodKey(item.name, item.cuisine) === foodKey(entry.name, cuisine),
      )
    )
      result.push({ ...entry, cuisine });
  }
  return result;
}
