import {
  dishes,
  findCatalogDish,
  foodKey,
  type Cuisine,
  type FoodEntry,
} from "../../food-dex/models/foodDex.ts";
import { atlasCuisines } from "../../food-dex/models/discovery.ts";
import { atlasCountries } from "../data/atlasCountries.ts";

// Culinary groupings may span several countries; these are discovery overlays.
export const cuisineCountries: Partial<Record<Cuisine, readonly string[]>> = {
  Chinese: ["CHN", "TWN"],
  Korean: ["PRK", "KOR"],
  Japanese: ["JPN"],
  Vietnamese: ["VNM"],
  Thai: ["THA"],
  "South Asian": ["IND", "PAK", "BGD", "NPL", "LKA"],
  Levant: ["TUR", "JOR", "SYR", "LBN", "ISR", "PSX"],
  Greek: ["GRC"],
  Persian: ["IRN", "IRQ", "AFG"],
  French: ["FRA"],
  Italian: ["ITA"],
  Latin: ["MEX", "PRI", "ARG", "CHL", "BRA", "COL", "CRI"],
  Caribbean: ["JAM", "CUB", "HTI", "DOM", "TTO"],
  American: ["USA"],
};
export function atlasProgress(entries: FoodEntry[], cuisine: Cuisine) {
  const targets = dishes.filter((dish) => dish.cuisineIds.includes(cuisine));
  const matched = new Set(
    entries.flatMap((entry) => {
      // Unclassified discoveries never imply a geographic origin.
      if (entry.cuisine === "Other") return [];
      const dish = findCatalogDish(entry.name, entry.cuisine);
      return dish ? [dish.id] : [];
    }),
  );
  const collected = targets.filter((dish) => matched.has(dish.id));
  const discoveries = new Set(
    entries
      .filter(
        (entry) =>
          entry.cuisine !== "Other" &&
          (entry.cuisine === cuisine ||
            findCatalogDish(entry.name, entry.cuisine)?.cuisineIds.includes(
              cuisine,
            )),
      )
      .map((entry) => foodKey(entry.name, entry.cuisine)),
  ).size;
  return {
    cuisine,
    total: targets.length,
    collected,
    discoveries,
    fraction: targets.length ? collected.length / targets.length : 0,
  };
}
export function atlasPoint(longitude: number, latitude: number) {
  const l = (longitude * Math.PI) / 180,
    f = (latitude * Math.PI) / 180;
  const f2 = f * f,
    f4 = f2 * f2;
  return {
    x:
      360 +
      128 *
        l *
        (0.8707 -
          0.131979 * f2 +
          f4 * (-0.013791 + f4 * (0.003971 * f2 - 0.001529 * f4))),
    y:
      195 -
      128 *
        f *
        (1.007226 +
          f2 * (0.015085 + f4 * (-0.044475 + 0.028874 * f2 - 0.005916 * f4))),
  };
}
function contains(ring: number[][], x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i]!,
      b = ring[j]!;
    if (
      a[1]! > y !== b[1]! > y &&
      x < ((b[0]! - a[0]!) * (y - a[1]!)) / (b[1]! - a[1]!) + a[0]!
    )
      inside = !inside;
  }
  return inside;
}
const cuisineAnchors: Partial<Record<Cuisine, readonly [number, number]>> = {
  Chinese: [105, 35],
  Korean: [127, 37],
  Japanese: [138, 36],
  Vietnamese: [108, 16],
  Thai: [101, 16],
  "South Asian": [78, 22],
  Levant: [36, 32],
  Greek: [22, 39],
  Persian: [54, 32],
  French: [2, 47],
  Italian: [12, 42],
  Latin: [-70, -10],
  Caribbean: [-75, 19],
  American: [-100, 39],
};
export function cuisineAtPoint(x: number, y: number): Cuisine | undefined {
  const country = countryAtPoint(x, y);
  if (!country) return undefined;
  const exact = atlasCuisines.find((cuisine) =>
    cuisineCountries[cuisine]?.includes(country),
  );
  if (exact) return exact;

  // Every country remains explorable, even when it has no dedicated cuisine group.
  return atlasCuisines.reduce<Cuisine | undefined>((closest, cuisine) => {
    const anchor = cuisineAnchors[cuisine];
    if (!anchor) return closest;
    const point = atlasPoint(anchor[0], anchor[1]);
    const distance = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (!closest) return cuisine;
    const closestAnchor = cuisineAnchors[closest]!;
    const closestPoint = atlasPoint(closestAnchor[0], closestAnchor[1]);
    return distance < (closestPoint.x - x) ** 2 + (closestPoint.y - y) ** 2
      ? cuisine
      : closest;
  }, undefined);
}
export function countryAtPoint(x: number, y: number): string | undefined {
  return atlasCountries.find((country) =>
    country.rings.some((ring) => contains(ring, x, y)),
  )?.code;
}
const paths = atlasCountries.map((country) => ({
  code: country.code,
  path: country.rings
    .map((ring) => `M${ring.map((point) => point.join(",")).join("L")}Z`)
    .join(""),
}));
export function atlasSvg(
  entries: FoodEntry[],
  selectedCountry?: string | null,
  selectedCuisine?: Cuisine | null,
) {
  const progress = atlasCuisines.map((cuisine) =>
    atlasProgress(entries, cuisine),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 390"><g stroke="#FFFDF5" stroke-width="0.65" stroke-linejoin="round">${paths
    .map((country) => {
      const row = progress.find(
        (row) =>
          row.discoveries > 0 &&
          cuisineCountries[row.cuisine]?.includes(country.code),
      );
      const selected = country.code === selectedCountry ||
        (selectedCuisine && cuisineCountries[selectedCuisine]?.includes(country.code));
      const fill = selected
        ? "#E56B72"
        : !row
        ? "#DCE2D5"
        : row.fraction >= 0.5
          ? "#3D568F"
          : row.fraction >= 0.15
            ? "#7C9A70"
            : "#BCD379";
      return `<path fill="${fill}" stroke="${selected ? "#9D3946" : "#FFFDF5"}" stroke-width="${selected ? 1.8 : 0.65}" d="${country.path}"/>`;
    })
    .join("")}</g></svg>`;
}
