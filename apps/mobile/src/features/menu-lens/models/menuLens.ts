import {
  dishes,
  foodKey,
  type FoodEntry,
} from "../../food-dex/models/foodDex.ts";
import type { Profile } from "../../profile/models/profile.ts";
import type {
  MenuBox,
  MenuDish,
} from "../../../../../../packages/food-catalog/src/menuLens.ts";
export type { MenuDish } from "../../../../../../packages/food-catalog/src/menuLens.ts";

export function menuDiscovery(
  dish: MenuDish,
  entries: FoodEntry[],
  diet: Profile["diet"],
) {
  const catalog = dishes.find((item) => item.id === dish.catalogId);
  const cuisine = catalog?.cuisine ?? dish.cuisine;
  const name = catalog?.name ?? dish.name;
  const collected = entries.some(
    (entry) => foodKey(entry.name, entry.cuisine) === foodKey(name, cuisine),
  );
  const cuisineCount = new Set(
    entries
      .filter((entry) => entry.cuisine === cuisine)
      .map((entry) => foodKey(entry.name, cuisine)),
  ).size;
  const conflicts = dish.dietaryFlags.filter(
    (flag) =>
      diet === "Vegan" ||
      (diet === "Vegetarian" && (flag === "meat" || flag === "fish")) ||
      (diet === "Pescatarian" && flag === "meat"),
  );
  return {
    catalog,
    name,
    cuisine,
    collected,
    cuisineCount,
    conflicts,
    total: dishes.filter((item) => item.cuisine === cuisine).length,
    rare: !collected && cuisine !== "Other" && cuisineCount < 2,
  };
}

// Match Image resizeMode="contain", including letterboxing on either axis.
export function containMenuBox(
  box: MenuBox,
  image: { width: number; height: number },
  viewport: { width: number; height: number },
): MenuBox | null {
  if (
    ![image.width, image.height, viewport.width, viewport.height].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    return null;
  const scale = Math.min(
    viewport.width / image.width,
    viewport.height / image.height,
  );
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    x: (viewport.width - width) / 2 + box.x * width,
    y: (viewport.height - height) / 2 + box.y * height,
    width: box.width * width,
    height: box.height * height,
  };
}

export const sampleMenu: MenuDish[] = [
  {
    name: "Margherita Pizza",
    cuisine: "Italian",
    description: "Tomato, mozzarella and fresh basil.",
    dietaryFlags: ["dairy"],
    catalogId: "pizza",
  },
  {
    name: "Pad Thai",
    cuisine: "Thai",
    description: "Rice noodles with shrimp, egg, tamarind and peanuts.",
    dietaryFlags: ["fish", "egg"],
    catalogId: "pad-thai",
  },
  {
    name: "Bibimbap",
    cuisine: "Korean",
    description: "Rice, vegetables, beef, egg and gochujang.",
    dietaryFlags: ["meat", "egg"],
    catalogId: "bibimbap",
  },
  {
    name: "Falafel",
    cuisine: "Levant",
    description: "Crisp chickpea fritters with herbs and tahini.",
    dietaryFlags: [],
    catalogId: "levant:themealdb:53266",
  },
].map((dish, index) => ({
  ...dish,
  id: `sample-${index}`,
  box: { x: 0.07, y: 0.24 + index * 0.17, width: 0.86, height: 0.13 },
})) as MenuDish[];
