// Type-only imports keep this module runnable in Node tests without a bundler.
import type { Place } from "../../restaurants/data/places";
import type { RestaurantCollection } from "../../restaurants/models/restaurantCollection";

export type Region = {
  id: string;
  name: string;
  // [west, south, east, north] in longitude/latitude degrees.
  bounds?: [number, number, number, number];
};

// Hand-drawn areas for the sample city. Boxes don't overlap; west and south edges are inclusive.
export const regions: Region[] = [
  {
    id: "kensington-chinatown",
    name: "Kensington & Chinatown",
    bounds: [-79.403, 43.649, -79.39, 43.66],
  },
  {
    id: "little-italy-trinity",
    name: "Little Italy & Trinity Bellwoods",
    bounds: [-79.43, 43.649, -79.403, 43.66],
  },
  {
    id: "queen-west",
    name: "Queen West",
    bounds: [-79.43, 43.64, -79.39, 43.649],
  },
  { id: "annex", name: "The Annex", bounds: [-79.43, 43.66, -79.39, 43.68] },
];

// Roughly 2 km cells, so places outside the drawn areas still group geographically.
const gridSize = 0.02;

export function regionFor([longitude, latitude]: [number, number]): Region {
  const match = regions.find(
    ({ bounds }) =>
      bounds &&
      longitude >= bounds[0] &&
      latitude >= bounds[1] &&
      longitude < bounds[2] &&
      latitude < bounds[3],
  );
  if (match) return match;
  const column = Math.floor(longitude / gridSize);
  const row = Math.floor(latitude / gridSize);
  return { id: `grid:${row}:${column}`, name: "Uncharted area" };
}

export const visitPoints = 10;
export const newRegionPoints = 50;

export type Visit = {
  place: Place;
  region: Region;
  at?: Date;
  // True for the first visited spot in its region, which earns the region bonus.
  newRegion: boolean;
};

export type Challenge = {
  id: string;
  title: string;
  description: string;
  icon:
    | "walk-outline"
    | "map-outline"
    | "compass-outline"
    | "cafe-outline"
    | "pizza-outline"
    | "storefront-outline"
    | "restaurant-outline";
  goal: number;
  progress: number;
  reward: number;
};

// One featured food type per month, rotating through the categories.
const featured = [
  { category: "Coffee", title: "Coffee crawl", icon: "cafe-outline" },
  { category: "Pizza", title: "Slice of the month", icon: "pizza-outline" },
  { category: "Bakery", title: "Pastry run", icon: "storefront-outline" },
  { category: "Ramen", title: "Noodle quest", icon: "restaurant-outline" },
] as const;

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// Visits in the order they happened. Undated visits from older journals come first.
export function visitHistory(
  collection: RestaurantCollection,
  places: Place[],
): Visit[] {
  const seen = new Set<string>();
  return collection.visited
    .map((id) => places.find((place) => place.id === id))
    .filter((place): place is Place => Boolean(place))
    .map((place) => {
      const at = collection.visitedAt[place.id];
      return {
        place,
        region: regionFor(place.coordinate),
        at: at ? new Date(at) : undefined,
      };
    })
    .sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0))
    .map((visit) => {
      const newRegion = !seen.has(visit.region.id);
      seen.add(visit.region.id);
      return { ...visit, newRegion };
    });
}

export function monthlyChallenges(
  history: Visit[],
  month: string,
  places: Place[],
): Challenge[] {
  const visits = history.filter(
    (visit) => visit.at && monthKey(visit.at) === month,
  );
  const [year, monthNumber] = month.split("-").map(Number);
  const theme = featured[(year! * 12 + monthNumber! - 1) % featured.length]!;
  const themeGoal = Math.min(
    2,
    places.filter((place) => place.category === theme.category).length,
  );
  return [
    {
      id: "regular",
      title: "Monthly regular",
      description: "Visit 3 different spots this month.",
      icon: "walk-outline",
      goal: 3,
      progress: visits.length,
      reward: 50,
    },
    {
      id: "region-hopper",
      title: "Region hopper",
      description: "Eat in 2 different regions this month.",
      icon: "map-outline",
      goal: 2,
      progress: new Set(visits.map((visit) => visit.region.id)).size,
      reward: 75,
    },
    {
      id: "new-territory",
      title: "New territory",
      description: "Discover a region you’ve never eaten in before.",
      icon: "compass-outline",
      goal: 1,
      progress: visits.filter((visit) => visit.newRegion).length,
      reward: 100,
    },
    {
      id: `featured-${theme.category.toLowerCase()}`,
      title: theme.title,
      description: `Visit ${themeGoal} ${theme.category.toLowerCase()} ${themeGoal === 1 ? "spot" : "spots"} this month.`,
      icon: theme.icon,
      goal: themeGoal,
      progress: visits.filter(
        (visit) => visit.place.category === theme.category,
      ).length,
      reward: 60,
    },
  ];
}

export function isComplete(challenge: Challenge) {
  return challenge.goal > 0 && challenge.progress >= challenge.goal;
}

function challengeRewards(challenges: Challenge[]) {
  return challenges
    .filter(isComplete)
    .reduce((sum, challenge) => sum + challenge.reward, 0);
}

function visitTotal(visits: Visit[]) {
  return visits.reduce(
    (sum, visit) => sum + visitPoints + (visit.newRegion ? newRegionPoints : 0),
    0,
  );
}

// Everything is derived from the Visited collection, so toggling a visit off removes its points.
export function rewardsSummary(
  collection: RestaurantCollection,
  places: Place[],
  now: Date,
) {
  const history = visitHistory(collection, places);
  const month = monthKey(now);
  const months = [
    ...new Set(
      history.flatMap((visit) => (visit.at ? [monthKey(visit.at)] : [])),
    ),
  ];
  const challengePoints = months.reduce(
    (sum, key) =>
      sum + challengeRewards(monthlyChallenges(history, key, places)),
    0,
  );
  const challenges = monthlyChallenges(history, month, places);
  const visitedRegions = new Set(history.map((visit) => visit.region.id));
  const visitsThisMonth = history.filter(
    (visit) => visit.at && monthKey(visit.at) === month,
  );
  return {
    total: visitTotal(history) + challengePoints,
    monthPoints: visitTotal(visitsThisMonth) + challengeRewards(challenges),
    regionBonusCount: history.filter((visit) => visit.newRegion).length,
    challenges,
    daysLeft:
      new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() -
      now.getDate() +
      1,
    regions: regions.map((region) => {
      const inRegion = places.filter(
        (place) => regionFor(place.coordinate).id === region.id,
      );
      return {
        ...region,
        total: inRegion.length,
        visited: inRegion.filter((place) =>
          collection.visited.includes(place.id),
        ).length,
        discovered: visitedRegions.has(region.id),
        next: inRegion.find((place) => !collection.visited.includes(place.id)),
      };
    }),
  };
}

// Points a spot would earn right now, before monthly challenge bonuses.
export function pointsForVisit(
  place: Place,
  collection: RestaurantCollection,
  places: Place[],
) {
  if (collection.visited.includes(place.id)) return null;
  const region = regionFor(place.coordinate);
  const newRegion = !collection.visited.some((id) => {
    const visited = places.find((item) => item.id === id);
    return visited && regionFor(visited.coordinate).id === region.id;
  });
  return {
    points: visitPoints + (newRegion ? newRegionPoints : 0),
    newRegion,
    region,
  };
}
