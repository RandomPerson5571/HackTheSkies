import { catalogDishes } from "../../../../../../packages/food-catalog/data/catalog.ts";
import restaurantPhotos from "./restaurantPhotos.json" with { type: "json" };
import importedRestaurants from "./importedRestaurants.json" with { type: "json" };

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
  // Optional aggregate from a future community/provider feed. Missing is unrated.
  ratingSummary?: { averageRating: number; reviewCount: number };
};

const photos: Record<string, NonNullable<Place["photo"]>> = restaurantPhotos;

// A cuisine illustration is explicitly distinguished from a photo of the venue.
function photoFor(restaurant: (typeof importedRestaurants)[number]): Place["photo"] {
  if (photos[restaurant.id]) return photos[restaurant.id];
  const candidates = catalogDishes.filter((dish) => dish.image && dish.cuisine === restaurant.cuisine);
  const pool = candidates.length ? candidates : catalogDishes.filter((dish) => dish.image);
  const hash = [...restaurant.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0);
  const dish = pool[hash % pool.length];
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

// Imported restaurant listings; not a live availability feed.
export const places: Place[] = importedRestaurants.map((restaurant): Place => ({
  id: restaurant.id,
  name: restaurant.restaurant_name,
  category: "Restaurant",
  cuisine: restaurant.cuisine,
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
}));

export const categories: Category[] = [
  "All",
  "Coffee",
  "Pizza",
  "Bakery",
  "Ramen",
  "Restaurant",
];
export const mapCenter = [-79.48, 43.67];
