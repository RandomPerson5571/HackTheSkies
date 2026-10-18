import { places as catalogPlaces, type Place } from "../../restaurants/data/places.ts";

// Fictional profiles for the local prototype; no requests are sent to real people.
type SampleVisit = {
  placeId: string;
  rating: number;
  note: string;
  comment: string;
  review: string;
  text: string;
  when: string;
};
export type SampleFriend = {
  id: string;
  name: string;
  handle: string;
  initials: string;
  bio: string;
  avatarUri?: string;
  profilePictureUri?: string;
  profilePicture?: string;
  avatarUrl?: string;
  photoUrl?: string;
  imageUrl?: string;
  imageUri?: string;
  visits: SampleVisit[];
};

export const sampleFriends: SampleFriend[] = [
  {
    id: "maya",
    name: "Maya Chen",
    handle: "@mayatastes",
    initials: "MC",
    bio: "Always room for ramen.",
    avatarUri: "https://i.pravatar.cc/150?u=maya",
    profilePictureUri: "https://i.pravatar.cc/150?u=maya",
    profilePicture: "https://i.pravatar.cc/150?u=maya",
    avatarUrl: "https://i.pravatar.cc/150?u=maya",
    photoUrl: "https://i.pravatar.cc/150?u=maya",
    imageUrl: "https://i.pravatar.cc/150?u=maya",
    imageUri: "https://i.pravatar.cc/150?u=maya",
    visits: catalogPlaces.slice(0, 5).map((place, index) => {
      const rating = [5, 4, 5, 4, 3][index % 5]!;
      const note = `Loved the ${place.cuisine!.toLowerCase()} flavors at ${place.name}; would happily come back with friends.`;
      return {
        placeId: place.id,
        rating,
        note,
        comment: note,
        review: note,
        text: note,
        when: `2026-09-${String(10 + index).padStart(2, "0")}`,
      };
    }),
  },
  {
    id: "alex",
    name: "Alex Rivera",
    handle: "@alexaftercoffee",
    initials: "AR",
    bio: "Coffee first. Everything else later.",
    avatarUri: "https://i.pravatar.cc/150?u=alex",
    profilePictureUri: "https://i.pravatar.cc/150?u=alex",
    profilePicture: "https://i.pravatar.cc/150?u=alex",
    avatarUrl: "https://i.pravatar.cc/150?u=alex",
    photoUrl: "https://i.pravatar.cc/150?u=alex",
    imageUrl: "https://i.pravatar.cc/150?u=alex",
    imageUri: "https://i.pravatar.cc/150?u=alex",
    visits: catalogPlaces.slice(12, 17).map((place, index) => {
      const rating = [4, 5, 4, 5, 4][index % 5]!;
      const note = `Great stop for ${place.category.toLowerCase()}; the ${place.cuisine!.toLowerCase()} dishes really stood out.`;
      return {
        placeId: place.id,
        rating,
        note,
        comment: note,
        review: note,
        text: note,
        when: `2026-09-${String(18 + index).padStart(2, "0")}`,
      };
    }),
  },
  {
    id: "sam",
    name: "Sam Patel",
    handle: "@crumbtrail",
    initials: "SP",
    bio: "Following the scent of fresh bread.",
    avatarUri: "https://i.pravatar.cc/150?u=sam",
    profilePictureUri: "https://i.pravatar.cc/150?u=sam",
    profilePicture: "https://i.pravatar.cc/150?u=sam",
    avatarUrl: "https://i.pravatar.cc/150?u=sam",
    photoUrl: "https://i.pravatar.cc/150?u=sam",
    imageUrl: "https://i.pravatar.cc/150?u=sam",
    imageUri: "https://i.pravatar.cc/150?u=sam",
    visits: catalogPlaces.slice(24, 29).map((place, index) => {
      const rating = [5, 3, 4, 5, 4][index % 5]!;
      const note = `Found a lovely ${place.cuisine!.toLowerCase()} bite in ${place.neighborhood}; left with a new favorite.`;
      return {
        placeId: place.id,
        rating,
        note,
        comment: note,
        review: note,
        text: note,
        when: `2026-09-${String(26 + index).padStart(2, "0")}`,
      };
    }),
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
    description: "Visit two different bakeries for your next pastry favorite.",
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
    name: "Pasta explorer",
    category: "Italian",
    cuisine: true,
    goal: 2,
    icon: "restaurant-outline",
    description: "Visit two Italian restaurants to discover a new favorite.",
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
