import {
  cuisines,
  cuisineRegions,
  dishes,
  findCatalogDish,
  foodKey,
  type Cuisine,
  type FoodEntry,
} from "./foodDex.ts";

export const cardTiers = {
  Classic: { color: "#BDE5DC", ink: "#174F49", stars: 1 },
  Rare: { color: "#B8D8FF", ink: "#244B80", stars: 2 },
  Epic: { color: "#DAC7FF", ink: "#60408C", stars: 3 },
  Legendary: { color: "#F4DB91", ink: "#735016", stars: 4 },
} as const;
export type CardTier = keyof typeof cardTiers;

// Stable collectible tiers, independent of collection order. These are game
// attributes, not a ranking of cuisines or a claim about real-world scarcity.
export function cardTier(name: string, cuisine: Cuisine): CardTier {
  const dish = findCatalogDish(name, cuisine);
  const key = dish?.id ?? foodKey(name, cuisine);
  let hash = 2166136261;
  for (const character of key)
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  const roll = (hash >>> 0) % 100;
  return roll < 50
    ? "Classic"
    : roll < 80
      ? "Rare"
      : roll < 95
        ? "Epic"
        : "Legendary";
}

export function collectionProgress(entries: FoodEntry[], cuisine?: Cuisine) {
  const unique = new Set(
    entries.map((entry) => foodKey(entry.name, entry.cuisine)),
  );
  const targets = cuisine
    ? dishes.filter((dish) => dish.cuisine === cuisine)
    : dishes;
  const collected = targets.filter((dish) =>
    unique.has(foodKey(dish.name, dish.cuisine)),
  ).length;
  return {
    collected,
    total: targets.length,
    fraction: targets.length ? collected / targets.length : 0,
  };
}

export type DiscoveryMilestone = {
  label: string;
  target: number;
};

export const discoveryMilestones: DiscoveryMilestone[] = [
  { label: "First Five", target: 5 },
  { label: "Ten Tastes", target: 10 },
  { label: "Twenty-Five Bites", target: 25 },
  { label: "Fifty Flavors", target: 50 },
  { label: "Century of Bites", target: 100 },
  { label: "Full Dex", target: 256 },
];

export function nextDiscoveryMilestone(count: number) {
  const next =
    discoveryMilestones.find((milestone) => milestone.target > count) ??
    discoveryMilestones[discoveryMilestones.length - 1];
  const current = Math.min(Math.max(0, count), next.target);
  return {
    ...next,
    current,
    remaining: Math.max(0, next.target - count),
    fraction: next.target ? current / next.target : 0,
  };
}

export type CuisineMastery = "Bronze" | "Silver" | "Gold";

export function cuisineMastery(
  unlocked: number,
  total: number,
): CuisineMastery | null {
  if (total <= 0 || unlocked <= 0) return null;
  if (unlocked >= total) return "Gold";
  if (unlocked >= Math.ceil(total / 2)) return "Silver";
  if (unlocked >= 3) return "Bronze";
  return null;
}

export function cuisineMasteryTarget(
  unlocked: number,
  total: number,
): { label: string; target: number } {
  if (total <= 0) return { label: "Collect dishes", target: 0 };
  if (unlocked < 3) return { label: "Bronze badge", target: 3 };
  if (unlocked < Math.ceil(total / 2))
    return { label: "Silver badge", target: Math.ceil(total / 2) };
  if (unlocked < total) return { label: "Gold badge", target: total };
  return { label: "Mastered", target: total };
}

export type Coordinate = readonly [longitude: number, latitude: number];
// Representative culinary anchors for the app's cuisine groupings, not borders.
export const cuisineAnchors: Partial<Record<Cuisine, Coordinate>> = {
  Chinese: [108, 35],
  Korean: [127.5, 37],
  Japanese: [138, 36],
  Vietnamese: [106, 16],
  Thai: [101, 15],
  "South Asian": [78, 22],
  Levant: [36, 33],
  Greek: [23, 39],
  Persian: [53, 33],
  French: [2, 47],
  Italian: [12, 42],
  Latin: [-99, 22],
  Caribbean: [-74, 20],
  American: [-100, 39],
};
export const atlasCuisines = cuisines.filter(
  (cuisine) => cuisineAnchors[cuisine],
);

export function exploredCuisines(entries: FoodEntry[]) {
  return atlasCuisines.filter((cuisine) =>
    entries.some((entry) => entry.cuisine === cuisine),
  );
}

// A small local knowledge graph: dish → cuisine → region, with thematic edges
// backed by the actual dish names and descriptions in the food catalog.
const themes = [
  {
    name: "Noodles",
    pattern: /\b(noodle|noodles|ramen|udon|soba|pho|pad thai|pad-thai)\b/i,
  },
  { name: "Rice", pattern: /\b(rice|risotto|biryani|bibimbap|sushi)\b/i },
  {
    name: "Dumplings",
    pattern:
      /\b(dumpling|dumplings|momo|momos|gyoza|ravioli|wonton|wontons)\b/i,
  },
  {
    name: "Bread & pastry",
    pattern: /\b(bread|pastry|pastries|flatbread|croissant|bun|buns)\b/i,
  },
  {
    name: "Grilled favorites",
    pattern: /\b(grilled|grill|barbecue|barbecued|kebab|skewer|skewers)\b/i,
  },
  { name: "Soups & stews", pattern: /\b(soup|soups|stew|stews|broth)\b/i },
];
export function cuisineConnections(cuisine: Cuisine) {
  const own = dishes.filter((dish) => dish.cuisineIds.includes(cuisine));
  return atlasCuisines
    .filter((other) => other !== cuisine)
    .flatMap((other) => {
      const otherDishes = dishes.filter((dish) =>
        dish.cuisineIds.includes(other),
      );
      const shared = themes.flatMap((theme) => {
        const from = own.find((dish) =>
          theme.pattern.test(`${dish.name} ${dish.note}`),
        );
        const to = otherDishes.find((dish) =>
          theme.pattern.test(`${dish.name} ${dish.note}`),
        );
        return from && to ? [{ theme: theme.name, from, to }] : [];
      });
      return shared.length
        ? [{ cuisine: other, shared, regions: cuisineRegions[other] }]
        : [];
    })
    .sort((a, b) => b.shared.length - a.shared.length)
    .slice(0, 3);
}

export function project(
  [longitude, latitude]: Coordinate,
  rotation: number,
  radius = 138,
) {
  const lon = ((longitude - rotation) * Math.PI) / 180;
  const lat = (latitude * Math.PI) / 180;
  const tilt = (15 * Math.PI) / 180;
  const x = Math.cos(lat) * Math.sin(lon);
  const y = Math.sin(lat);
  const z = Math.cos(lat) * Math.cos(lon);
  return {
    x: radius + radius * x,
    y: radius - radius * (y * Math.cos(tilt) - z * Math.sin(tilt)),
    visible: y * Math.sin(tilt) + z * Math.cos(tilt) > 0,
  };
}
