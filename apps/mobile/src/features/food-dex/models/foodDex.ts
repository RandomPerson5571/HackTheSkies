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
};
export type Dish = CatalogDish;
export const dishes: Dish[] = catalogDishes;

const defaultImage =
  "https://images.unsplash.com/photo-1547592180-85f173990554?w=600&q=80";
const starterImages: Partial<Record<Cuisine, string>> = {
  Japanese:
    "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=600&q=80",
  Italian:
    "https://images.unsplash.com/photo-1579751626657-72bc17010498?w=600&q=80",
  Latin:
    "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=600&q=80",
  "South Asian":
    "https://images.unsplash.com/photo-1565557623262-b51c2513a641?w=600&q=80",
  Chinese:
    "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600&q=80",
  Thai: "https://images.unsplash.com/photo-1559314809-0d155014e29e?w=600&q=80",
};
export const cuisineImages = Object.fromEntries(
  cuisines.map((cuisine) => [cuisine, starterImages[cuisine] ?? defaultImage]),
) as Record<Cuisine, string>;

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
      Number.isNaN(Date.parse(entry.discoveredAt))
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
