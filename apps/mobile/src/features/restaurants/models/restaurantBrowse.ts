import type { Place } from "../data/places";
export type RestaurantSort = "discovery" | "name";
export function browseRestaurants(
  places: Place[],
  options: {
    query: string;
    category: string;
    cuisine: string;
    sort: RestaurantSort;
  },
  scores: ReadonlyMap<string, { score: number }>,
) {
  const query = options.query.trim().toLocaleLowerCase();
  return places
    .filter(
      (place) =>
        (options.category === "All" || place.category === options.category) &&
        (options.cuisine === "All" || place.cuisine === options.cuisine) &&
        `${place.name} ${place.category} ${place.cuisine ?? ""} ${place.neighborhood} ${place.address}`
          .toLocaleLowerCase()
          .includes(query),
    )
    .sort(
      options.sort === "name"
        ? (a, b) => a.name.localeCompare(b.name)
        : (a, b) =>
            (scores.get(b.id)?.score ?? 0) - (scores.get(a.id)?.score ?? 0),
    );
}
export function surpriseCuisine(
  cuisines: string[],
  current: string,
  random = Math.random,
) {
  const options = cuisines.filter(
    (cuisine) => cuisine !== "All" && cuisine !== current,
  );
  return (
    options[
      Math.min(
        options.length - 1,
        Math.max(0, Math.floor(random() * options.length)),
      )
    ] ?? current
  );
}
