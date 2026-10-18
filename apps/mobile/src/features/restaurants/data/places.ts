import { catalogDishes } from "../../../../../../packages/food-catalog/data/catalog.ts";
import { cuisineCovers } from "../../food-dex/models/foodDex.ts";
import restaurantPhotos from "./restaurantPhotos.json" with { type: "json" };
import importedRestaurants from "./importedRestaurants.json" with { type: "json" };
import type { DietaryPreference } from "../../profile/models/profile";
import {
  rarityPolicy,
  rarityScore,
  type Rarity,
} from "../models/recommendations.ts";

export type Category =
  "All" | "Coffee" | "Pizza" | "Bakery" | "Ramen" | "Restaurant";
export const restaurantTypes = [
  "Fast Food/QSR",
  "Bakery",
  "Dine-in",
  "Fine Dining",
  "Cafe",
  "Beverage",
  "Bar & Lounge",
  "Food Truck/Stand",
] as const;
export const foodSpecialties = [
  "Sushi",
  "Healthy",
  "Bubble Tea",
  "Wings",
  "Sandwiches",
  "Soup",
  "Poke",
  "Burgers",
  "BBQ",
  "Salads",
] as const;
export const priceLevels = ["$", "$$", "$$$", "$$$$"] as const;
export type PriceLevel = (typeof priceLevels)[number];
export const cuisines = [
  "Chinese",
  "Korean",
  "Japanese",
  "Vietnamese",
  "Thai",
  "South Asian",
  "Levant",
  "Greek",
  "Persian",
  "French",
  "Italian",
  "Latin",
  "Caribbean",
  "American",
  "Other",
] as const;
export const cuisineRegions: Record<(typeof cuisines)[number], string> = {
  Chinese: "China, Taiwan, Tibet, Hong Kong",
  Korean: "North Korea, South Korea",
  Japanese: "Japan",
  Vietnamese: "Vietnam",
  Thai: "Thailand",
  "South Asian": "North/South India, Pakistan, Bangladesh, Nepal, Sri Lanka",
  Levant: "Turkey, Jordan, Syria, Lebanon, Israel, Palestine",
  Greek: "",
  Persian: "Iran, Iraq, Afghanistan",
  French: "",
  Italian: "",
  Latin: "Mexico, Puerto Rico, Argentina, Chile, Brazil, Colombia, Costa Rica",
  Caribbean: "Jamaica, Cuba, Haiti, Dominican Republic, Trinidad",
  American: "",
  Other: "",
};
export type Place = {
  id: string;
  name: string;
  category: Exclude<Category, "All">;
  type?: string;
  neighborhood: string;
  address: string;
  coordinate: [number, number];
  image: string;
  photo?: { url: string; sourceUrl: string; photographer: string | null; licenseName: string | null; licenseUrl: string | null; provider?: string; kind?: "restaurant" | "illustration"; dishName?: string; capturedAt: string };
  note: string;
  cuisine?: string;
  sourceUrl?: string;
  locationAccuracy?: string;
  priceLevel?: PriceLevel;
  rating?: number;
  // Public rating count from the listing source; missing when no page matched.
  ratingCount?: number;
  rarity?: Rarity;
  // Optional aggregate from a future community/provider feed. Missing is unrated.
  ratingSummary?: { averageRating: number; reviewCount: number };
  /** Compliance must be explicitly confirmed by a reliable venue/provider source. */
  confirmedDietaryOptions?: ("Halal" | "Kosher" | "Gluten-free")[];
};

export function matchesDietaryPreference(
  place: Pick<Place, "confirmedDietaryOptions">,
  diet: DietaryPreference,
): boolean {
  if (diet !== "Halal" && diet !== "Kosher" && diet !== "Gluten-free")
    return true;
  return place.confirmedDietaryOptions?.includes(diet) === true;
}

const photos: Record<string, NonNullable<Place["photo"]>> = restaurantPhotos;

// Venues in these cuisines show the Food Dex cover rather than a random dish,
// so they don't land on a studio cut-out like the cheeseburger or croissant.
const coverOnlyCuisines = new Set(["French", "American"]);

// A cuisine illustration is explicitly distinguished from a photo of the venue.
function photoFor(restaurant: (typeof importedRestaurants)[number]): Place["photo"] {
  if (photos[restaurant.id]) return photos[restaurant.id];
  const candidates = catalogDishes.filter((dish) => dish.image && dish.cuisine === restaurant.cuisine);
  const pool = candidates.length ? candidates : catalogDishes.filter((dish) => dish.image);
  const hash = [...restaurant.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  const dish = coverOnlyCuisines.has(restaurant.cuisine)
    ? cuisineCovers[restaurant.cuisine as keyof typeof cuisineCovers]
    : pool[hash % pool.length];
  if (!dish?.image) return undefined;
  return {
    url: dish.image.url,
    sourceUrl: dish.image.sourceUrl,
    photographer: dish.image.photographer,
    licenseName: dish.image.licenseName || null,
    licenseUrl: dish.image.licenseUrl,
    capturedAt: "",
    provider: dish.image.source,
    kind: "illustration",
    dishName: dish.name,
  };
}

type ImportedRestaurant = (typeof importedRestaurants)[number] & {
  rating_count?: number | null;
};
const ratingCounts = (importedRestaurants as ImportedRestaurant[])
  .map((restaurant) => restaurant.rating_count)
  .filter(
    (count): count is number =>
      typeof count === "number" && count >= rarityPolicy.minimumRatings,
  )
  .sort((a, b) => a - b);
// Venues without enough public ratings are scored as if they had the median
// count, so they are neither boosted nor penalised for missing data.
const medianRatingCount = ratingCounts[Math.floor(ratingCounts.length / 2)];

function rarityFor(restaurant: ImportedRestaurant): Rarity | undefined {
  const count =
    (restaurant.rating_count ?? 0) >= rarityPolicy.minimumRatings
      ? restaurant.rating_count!
      : undefined;
  const value = rarityScore(restaurant.rating, count ?? medianRatingCount ?? 0);
  return value === null ? undefined : { value, estimated: count === undefined };
}

// Imported restaurant listings; not a live availability feed.
export const places: Place[] = importedRestaurants.map((restaurant): Place => ({
  id: restaurant.id,
  name: restaurant.restaurant_name,
  category: "Restaurant",
  cuisine: restaurant.cuisine,
  confirmedDietaryOptions: (
    restaurant as typeof restaurant & {
      confirmed_dietary_options?: ("Halal" | "Kosher" | "Gluten-free")[];
    }
  ).confirmed_dietary_options,
  neighborhood: restaurant.neighbourhood,
  address: `${restaurant.address}, Toronto, ON`,
  coordinate: [restaurant.coordinate[0]!, restaurant.coordinate[1]!],
  photo: photoFor(restaurant),
  image: photoFor(restaurant)?.url ??
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=400&fit=crop",
  note: `${restaurant.cuisine} · ${restaurant.category}.${restaurant.locationAccuracy === "approximate" ? " Approximate map location." : ""} Map data © OpenStreetMap contributors.`,
  sourceUrl: restaurant.source_url,
  locationAccuracy: restaurant.locationAccuracy,
  priceLevel:
    restaurant.estimated_price_range === "$0-$15"
      ? "$"
      : restaurant.estimated_price_range === "$15-$30"
        ? "$$"
        : restaurant.category === "Fine Dining"
          ? "$$$$"
          : "$$$",
  rating: restaurant.rating,
  ratingCount: (restaurant as ImportedRestaurant).rating_count ?? undefined,
  rarity: rarityFor(restaurant),
}));

export const categories: Category[] = [
  "All",
  "Coffee",
  "Pizza",
  "Bakery",
  "Ramen",
  "Restaurant",
];
export const mapCenter: [number, number] = [-79.48, 43.67];

// The [longitude, latitude] pair the map SDKs require.
export function isValidCoordinate(
  coordinate: unknown,
): coordinate is [number, number] {
  return (
    Array.isArray(coordinate) &&
    coordinate.length === 2 &&
    Number.isFinite(coordinate[0]) &&
    Number.isFinite(coordinate[1])
  );
}

export function placeCenter(place: Place | undefined): [number, number] {
  return isValidCoordinate(place?.coordinate) ? place.coordinate : mapCenter;
}
