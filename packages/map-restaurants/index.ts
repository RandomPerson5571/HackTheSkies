export type Place = {
  id: string;
  name: string;
  category: "Restaurant" | "Coffee";
  type?: string;
  neighborhood: string;
  address: string;
  coordinate: [number, number];
  image: string;
  cuisine?: string;
  note: string;
  sourceUrl?: string;
  locationAccuracy?: string;
};

export type Bounds = readonly [number, number, number, number];
export function withinBounds(
  place: { coordinate: readonly number[] },
  [west, south, east, north]: Bounds,
) {
  const [lon, lat] = place.coordinate;
  const longitude = ((((lon + 180) % 360) + 360) % 360) - 180;
  return (
    lat >= south &&
    lat <= north &&
    (west <= east
      ? longitude >= west && longitude <= east
      : longitude >= west || longitude <= east)
  );
}

export function mergeMapRestaurants<T extends { id: string }>(
  ...sources: readonly T[][]
): T[] {
  return [
    ...new Map(sources.flat().map((place) => [place.id, place])).values(),
  ];
}

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};
export function osmRestaurants(elements: OsmElement[]): Place[] {
  return elements
    .filter((element) => element && typeof element === "object")
    .flatMap((element) => {
      const tags = element.tags ?? {};
      const lon = element.lon ?? element.center?.lon;
      const lat = element.lat ?? element.center?.lat;
      if (
        !["node", "way", "relation"].includes(element.type) ||
        !Number.isSafeInteger(element.id) ||
        element.id <= 0 ||
        typeof tags.name !== "string" ||
        !tags.name.trim() ||
        !Number.isFinite(lon) ||
        !Number.isFinite(lat) ||
        Math.abs(lon!) > 180 ||
        Math.abs(lat!) > 90 ||
        !["restaurant", "cafe", "fast_food", "food_court"].includes(
          tags.amenity,
        )
      )
        return [];
      return [
        {
          id: `osm-${element.type}-${element.id}`,
          name: tags.name,
          category:
            tags.amenity === "cafe"
              ? ("Coffee" as const)
              : ("Restaurant" as const),
          type:
            tags.amenity === "cafe"
              ? "Cafe"
              : tags.amenity === "fast_food"
                ? "Fast Food/QSR"
                : "Dine-in",
          neighborhood: tags["addr:suburb"] ?? tags["addr:city"] ?? "",
          address: [
            [tags["addr:housenumber"], tags["addr:street"]]
              .filter(Boolean)
              .join(" "),
            tags["addr:city"],
            tags["addr:province"],
          ]
            .filter(Boolean)
            .join(", "),
          coordinate: [lon!, lat!] as [number, number],
          image: "",
          cuisine:
            typeof tags.cuisine === "string"
              ? tags.cuisine.replaceAll(";", ", ").replaceAll("_", " ")
              : undefined,
          note: "Map data © OpenStreetMap contributors (ODbL). Community listing; details may be incomplete.",
          sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
          locationAccuracy: element.type === "node" ? "address" : "approximate",
        },
      ];
    });
}

// Query only city-sized views after the camera settles. Cached listings remain
// available in the overview without issuing province/world-sized public queries.
export function canLoadMapRestaurants(bounds: Bounds, zoom: number) {
  const [west, south, east, north] = bounds;
  return (
    Number.isFinite(zoom) &&
    bounds.every(Number.isFinite) &&
    west >= -180 &&
    east <= 180 &&
    south >= -85 &&
    north <= 85 &&
    east > west &&
    north > south &&
    zoom >= 10 &&
    (east - west) * (north - south) <= 0.5
  );
}

// Deliberately conservative rectangle for the CSV-only Toronto demo.
export const torontoDemoBounds: Bounds = [-79.65, 43.58, -79.1, 43.86];
export function isTorontoDemo(place: { coordinate: readonly number[] }) {
  return withinBounds(place, torontoDemoBounds);
}
export function isTorontoOnly([west, south, east, north]: Bounds) {
  const [w, s, e, n] = torontoDemoBounds;
  return west >= w && south >= s && east <= e && north <= n && west <= east;
}
// Outward rounding covers the full viewport and reuses results for small pans.
export function discoveryBounds(bounds: Bounds): Bounds {
  const lower = (value: number) =>
    Number((Math.floor(value * 20) / 20).toFixed(2));
  const upper = (value: number) =>
    Number((Math.ceil(value * 20) / 20).toFixed(2));
  return [
    lower(bounds[0]),
    lower(bounds[1]),
    upper(bounds[2]),
    upper(bounds[3]),
  ];
}
export function discoveryKey(bounds: Bounds) {
  return discoveryBounds(bounds).join(",");
}
