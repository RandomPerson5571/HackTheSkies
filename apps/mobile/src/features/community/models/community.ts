import type { Place } from "../../restaurants/data/places";

// Fictional profiles for the local prototype; no requests are sent to real people.
type SampleVisit = {
  placeId: string;
  rating: number;
  note: string;
  when: string;
};
export type SampleFriend = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  bio: string;
  visits: SampleVisit[];
};

export const sampleFriends: SampleFriend[] = [
  {
    id: "maya",
    name: "Maya Chen",
    handle: "@mayatastes",
    initials: "MC",
    bio: "Always room for ramen.",
    visits: [],
  },
  {
    id: "alex",
    name: "Alex Rivera",
    handle: "@alexaftercoffee",
    initials: "AR",
    bio: "Coffee first. Everything else later.",
    visits: [],
  },
  {
    id: "sam",
    name: "Sam Patel",
    handle: "@crumbtrail",
    initials: "SP",
    bio: "Following the scent of fresh bread.",
    visits: [],
  },
];

export const cuisineBadges = [
  {
    id: "japanese",
    name: "Japanese explorer",
    category: "Japanese",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Visit a Japanese spot. Start with a bowl of ramen.",
  },
  {
    id: "bakery",
    name: "Crumb collector",
    category: "Bakery",
    goal: 2,
    icon: "storefront-outline",
    description: "Visit two different bakeries for your pastry passport.",
  },
  {
    id: "coffee",
    name: "Coffee regular",
    category: "Coffee",
    goal: 2,
    icon: "cafe-outline",
    description: "Find your ritual at two different coffee shops.",
  },
  {
    id: "pizza",
    name: "Slice seeker",
    category: "Pizza",
    goal: 1,
    icon: "pizza-outline",
    description: "Visit a pizza spot and find your favorite slice.",
  },
  {
    id: "korean",
    name: "Korean table",
    category: "Korean",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Explore Korean cooking at two different spots.",
  },
  {
    id: "chinese",
    name: "Wok star",
    category: "Chinese",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Taste your way through two Chinese restaurants.",
  },
  {
    id: "thai",
    name: "Thai trailblazer",
    category: "Thai",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Visit two spots serving Thai cuisine.",
  },
  {
    id: "south_asian",
    name: "Spice route",
    category: "South Asian",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Discover South Asian flavors at two spots.",
  },
  {
    id: "italian",
    name: "Pasta passport",
    category: "Italian",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Visit two Italian restaurants to fill your passport.",
  },
  {
    id: "latin",
    name: "Latin flavor finder",
    category: "Latin",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Find Latin cuisine at two different spots.",
  },
  {
    id: "french",
    name: "French connection",
    category: "French",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Enjoy French cooking at two different spots.",
  },
  {
    id: "caribbean",
    name: "Island sampler",
    category: "Caribbean",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Explore Caribbean cuisine at two spots.",
  },
  {
    id: "greek",
    name: "Aegean appetite",
    category: "Greek",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Find Greek favorites at two different spots.",
  },
  {
    id: "restaurant_regular",
    name: "Neighborhood regular",
    category: "Restaurant",
    goal: 5,
    icon: "storefront-outline",
    description: "Visit five different restaurants around your city.",
  },
] as const;

export function badgeProgress(
  category: string | { category: string; cuisine?: boolean },
  visited: string[],
  places: Place[],
) {
  const target = typeof category === "string" ? category : category.category;
  const matchCuisine = typeof category !== "string" && category.cuisine;
  return places.filter(
    (place) =>
      visited.includes(place.id) &&
      (matchCuisine ? place.cuisine === target : place.category === target),
  ).length;
}

export const pointPolicy = { perVisit: 10, perBadge: 50 } as const;

export function calculatePoints(visited: string[], places: Place[]) {
  const validPlaceIds = new Set(places.map((place) => place.id));
  const visitCount = [...new Set(visited)].filter((id) =>
    validPlaceIds.has(id),
  ).length;
  const earnedBadgeCount = cuisineBadges.filter(
    (badge) => badgeProgress(badge, visited, places) >= badge.goal,
  ).length;
  return (
    visitCount * pointPolicy.perVisit + earnedBadgeCount * pointPolicy.perBadge
  );
}
