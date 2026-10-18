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
    category: "Ramen",
    goal: 1,
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
] as const;

export function badgeProgress(
  category: Place["category"],
  visited: string[],
  places: Place[],
) {
  return places.filter(
    (place) => place.category === category && visited.includes(place.id),
  ).length;
}
