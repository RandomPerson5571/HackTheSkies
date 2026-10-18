import globalRestaurantSample from "../../../../../../data/global-restaurant-sample.json" with { type: "json" };
import type { DietaryPreference } from "../../profile/models/profile";

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
  country?: string;
  sourceUrl?: string;
  locationAccuracy?: string;
  priceLevel?: PriceLevel;
  rating?: number;
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

// Offline catalog sample collected from Geoapify/OpenStreetMap. Live viewport
// searches can return other restaurants; this bundled sample is capped at 400.
export const places: Place[] = globalRestaurantSample
  .slice(0, 400)
  .map((restaurant): Place => ({
    id: restaurant.id,
    name: restaurant.name,
    category: "Restaurant",
    country: restaurant.country,
    neighborhood: restaurant.neighborhood,
    address: [restaurant.address, restaurant.country]
      .filter(Boolean)
      .join(", "),
    coordinate: [restaurant.coordinate[0]!, restaurant.coordinate[1]!],
    image: "",
    note: restaurant.note,
    sourceUrl: restaurant.sourceUrl,
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
