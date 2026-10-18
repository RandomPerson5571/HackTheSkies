import { normalizeCuisine, type Cuisine } from "./cuisines.ts";

export type MenuBox = { x: number; y: number; width: number; height: number };
export const dietaryFlags = ["meat", "fish", "dairy", "egg", "honey"] as const;
export type DietaryFlag = (typeof dietaryFlags)[number];
export type MenuDish = {
  id: string;
  name: string;
  cuisine: Cuisine;
  description: string;
  dietaryFlags: DietaryFlag[];
  box: MenuBox | null;
  catalogId: string | null;
};

// Invalid coordinates remove the anchor, never the readable list result.
export function parseMenuBox(value: unknown): MenuBox | null {
  if (!value || typeof value !== "object") return null;
  const b = value as MenuBox;
  if (
    ![b.x, b.y, b.width, b.height].every(Number.isFinite) ||
    b.x < 0 ||
    b.x >= 1 ||
    b.y < 0 ||
    b.y >= 1 ||
    b.width <= 0 ||
    b.height <= 0 ||
    b.x + b.width > 1.001 ||
    b.y + b.height > 1.001
  )
    return null;
  return {
    x: b.x,
    y: b.y,
    width: Math.min(b.width, 1 - b.x),
    height: Math.min(b.height, 1 - b.y),
  };
}

export function parseMenuDishes(value: unknown): MenuDish[] {
  if (!Array.isArray(value) || value.length > 24)
    throw new Error("Invalid menu result.");
  return value.map((item, index) => {
    const cuisine = normalizeCuisine(item?.cuisine);
    if (
      !item ||
      typeof item.name !== "string" ||
      !item.name.trim() ||
      !cuisine ||
      typeof item.description !== "string" ||
      !Array.isArray(item.dietaryFlags) ||
      !item.dietaryFlags.every((flag: unknown) =>
        dietaryFlags.includes(flag as DietaryFlag),
      )
    )
      throw new Error("Invalid menu dish.");
    return {
      id: `menu-${index}`,
      name: item.name.trim().slice(0, 100),
      cuisine,
      description: item.description.trim().slice(0, 500),
      dietaryFlags: [...new Set<DietaryFlag>(item.dietaryFlags)],
      box: parseMenuBox(item.box),
      catalogId:
        typeof item.catalogId === "string"
          ? item.catalogId.slice(0, 100)
          : null,
    };
  });
}
