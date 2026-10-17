import type { Place } from "./places";

// Fictional profiles for the local prototype; no requests are sent to real people.
export const sampleFriends = [
  {
    id: "maya",
    name: "Maya Chen",
    handle: "@mayatastes",
    initials: "MC",
    bio: "Always room for ramen.",
    visits: [
      {
        placeId: "ramen",
        rating: 5,
        note: "The kind of broth you think about all week.",
        when: "Yesterday",
      },
      {
        placeId: "bakery",
        rating: 4,
        note: "Get here early for the pastries.",
        when: "This week",
      },
    ],
  },
  {
    id: "alex",
    name: "Alex Rivera",
    handle: "@alexaftercoffee",
    initials: "AR",
    bio: "Coffee first. Everything else later.",
    visits: [
      {
        placeId: "espresso",
        rating: 5,
        note: "Found my new neighborhood coffee spot.",
        when: "Yesterday",
      },
      {
        placeId: "pizza",
        rating: 4,
        note: "One more slice is always the right call.",
        when: "This week",
      },
    ],
  },
  {
    id: "sam",
    name: "Sam Patel",
    handle: "@crumbtrail",
    initials: "SP",
    bio: "Following the scent of fresh bread.",
    visits: [
      {
        placeId: "bread",
        rating: 5,
        note: "A loaf worth crossing town for.",
        when: "Today",
      },
      {
        placeId: "coffee",
        rating: 4,
        note: "A perfect slow morning.",
        when: "This week",
      },
    ],
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
