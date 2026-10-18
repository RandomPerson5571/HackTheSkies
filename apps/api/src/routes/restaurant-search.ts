import type { ApiEnvironment } from "../environment.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=600, s-maxage=600",
};
const maxResults = 400;
const cacheTtlMs = 10 * 60 * 1000;
const responseCache = new Map<
  string,
  { expiresAt: number; body: { count: number; places?: PlaceResult[] } }
>();
const amenityFilter = "restaurant|cafe|fast_food|food_court";

type Bounds = { west: number; south: number; east: number; north: number };
type PlaceResult = {
  id: string;
  name: string;
  category: "Restaurant";
  cuisine?: string;
  country?: string;
  neighborhood: string;
  address: string;
  coordinate: [number, number];
  image: "";
  note: string;
  sourceUrl: string;
};
type OverpassElement = {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
};
type GeoapifyFeature = {
  type?: string;
  id?: string;
  geometry?: { type?: string; coordinates?: unknown };
  properties?: Record<string, unknown>;
};

function validBounds(value: unknown): value is Bounds {
  if (!value || typeof value !== "object") return false;
  const bounds = value as Record<string, unknown>;
  const values = [bounds.west, bounds.south, bounds.east, bounds.north];
  return (
    values.every((part) => typeof part === "number" && Number.isFinite(part)) &&
    (bounds.west as number) >= -180 &&
    (bounds.east as number) <= 180 &&
    (bounds.south as number) >= -90 &&
    (bounds.north as number) <= 90 &&
    (bounds.west as number) !== (bounds.east as number) &&
    (bounds.south as number) < (bounds.north as number)
  );
}

function splitBounds(bounds: Bounds) {
  const { west, east } = bounds;
  return west < east
    ? [{ west, east }]
    : [{ west, east: 180 }, { west: -180, east }];
}

function cacheKey(bounds: Bounds, mode: "count" | "details") {
  return `${mode}:${[bounds.west, bounds.south, bounds.east, bounds.north]
    .map((value) => value.toFixed(3))
    .join(",")}`;
}

function cached(key: string) {
  const hit = responseCache.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return undefined;
  }
  return hit.body;
}

function remember(key: string, body: { count: number; places?: PlaceResult[] }) {
  for (const [existingKey, item] of responseCache) {
    if (item.expiresAt <= Date.now()) responseCache.delete(existingKey);
  }
  while (responseCache.size >= 256) {
    const oldest = responseCache.keys().next().value;
    if (oldest === undefined) break;
    responseCache.delete(oldest);
  }
  responseCache.set(key, { expiresAt: Date.now() + cacheTtlMs, body });
  return body;
}

function overpassQuery(bounds: Bounds, mode: "count" | "details") {
  const selector = `nwr["amenity"~"^(${amenityFilter})$"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});`;
  return mode === "count"
    ? `[out:json][timeout:15];${selector}out count;`
    : `[out:json][timeout:25];${selector}out center tags qt ${maxResults};`;
}

async function fetchOverpass(bounds: Bounds, mode: "count" | "details") {
  const results: OverpassElement[] = [];
  let count = 0;
  for (const area of splitBounds(bounds)) {
    const query = overpassQuery({ ...bounds, ...area }, mode);
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "CiboRestaurantMap/1.0 (OpenStreetMap viewport search)",
      },
      body: new URLSearchParams({ data: query }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Overpass returned ${response.status}`);
    const payload = (await response.json()) as { elements?: OverpassElement[] };
    const elements = Array.isArray(payload.elements) ? payload.elements : [];
    if (mode === "count") {
      const total = Number(elements[0]?.tags?.total);
      if (Number.isFinite(total)) count += total;
    } else {
      results.push(...elements);
    }
  }
  return { count, elements: results };
}

function osmPlace(element: OverpassElement): PlaceResult | null {
  const tags = element.tags ?? {};
  const longitude = element.lon ?? element.center?.lon;
  const latitude = element.lat ?? element.center?.lat;
  const name = tags.name || tags.brand;
  if (
    !element.type ||
    typeof element.id !== "number" ||
    typeof longitude !== "number" ||
    typeof latitude !== "number" ||
    !name
  ) return null;
  const country = tags["addr:country"];
  const address = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:suburb"],
    tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
    tags["addr:state"],
    country,
  ].filter(Boolean).join(", ");
  return {
    id: `osm-${element.type}-${element.id}`,
    name,
    category: "Restaurant",
    cuisine: tags.cuisine,
    country,
    neighborhood: tags["addr:suburb"] || tags["addr:city"] || tags["addr:town"] || "",
    address,
    coordinate: [longitude, latitude],
    image: "",
    note: `OpenStreetMap · ${tags.amenity || "restaurant"}`,
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

function geoapifyPlace(feature: GeoapifyFeature): PlaceResult | null {
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  const name =
    (typeof properties.name === "string" && properties.name) ||
    (typeof properties.address_line1 === "string" && properties.address_line1);
  if (
    feature.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number" ||
    !name
  ) return null;
  const country = typeof properties.country === "string" ? properties.country : "";
  const address = [properties.address_line1, properties.address_line2, country]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(", ");
  const id = String(properties.place_id ?? feature.id ?? `${coordinates[0]}:${coordinates[1]}`);
  return {
    id: `geoapify-${id}`,
    name,
    category: "Restaurant",
    cuisine: typeof properties.catering_cuisine === "string" ? properties.catering_cuisine : undefined,
    country,
    neighborhood: typeof properties.suburb === "string" ? properties.suburb : typeof properties.city === "string" ? properties.city : "",
    address,
    coordinate: [coordinates[0], coordinates[1]],
    image: "",
    note: "OpenStreetMap contributors · Geoapify",
    sourceUrl: "https://www.openstreetmap.org/",
  };
}

async function fetchGeoapify(bounds: Bounds, apiKey: string) {
  const places = new Map<string, PlaceResult>();
  for (const area of splitBounds(bounds)) {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", "catering.restaurant,catering.cafe,catering.fast_food,catering.food_court");
    url.searchParams.set("filter", `rect:${area.west},${bounds.south},${area.east},${bounds.north}`);
    url.searchParams.set("limit", String(maxResults));
    url.searchParams.set("lang", "en");
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Geoapify returned ${response.status}`);
    const payload = (await response.json()) as { features?: GeoapifyFeature[] };
    for (const feature of payload.features ?? []) {
      const place = geoapifyPlace(feature);
      if (place) places.set(place.id, place);
    }
    if (places.size >= maxResults) break;
  }
  return [...places.values()];
}

function dedupePlaces(places: PlaceResult[]) {
  const unique = new Map<string, PlaceResult>();
  for (const place of places) {
    const identity = `${place.name.trim().toLowerCase()}:${place.coordinate[0].toFixed(4)}:${place.coordinate[1].toFixed(4)}`;
    if (!unique.has(identity)) unique.set(identity, place);
  }
  return [...unique.values()].slice(0, maxResults);
}

function mergeProviderPlaces(osmPlaces: PlaceResult[], geoapifyPlaces: PlaceResult[]) {
  // Reserve half of the response for each source when both have enough coverage.
  const merged: PlaceResult[] = [];
  const firstPassLimit = Math.ceil(maxResults / 2);
  for (let index = 0; index < firstPassLimit; index += 1) {
    if (osmPlaces[index]) merged.push(osmPlaces[index]);
    if (geoapifyPlaces[index]) merged.push(geoapifyPlaces[index]);
  }
  merged.push(...osmPlaces.slice(firstPassLimit), ...geoapifyPlaces.slice(firstPassLimit));
  return dedupePlaces(merged);
}

export async function POST(request: Request, env: ApiEnvironment): Promise<Response> {
  let body: { bounds?: unknown; mode?: unknown };
  try {
    body = (await request.json()) as { bounds?: unknown; mode?: unknown };
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400, headers });
  }
  if (!validBounds(body.bounds))
    return Response.json({ error: "Invalid map bounds." }, { status: 400, headers });
  const mode = body.mode === "count" ? "count" : body.mode === "details" ? "details" : null;
  if (!mode)
    return Response.json({ error: "Invalid search mode." }, { status: 400, headers });

  const key = cacheKey(body.bounds, mode);
  const hit = cached(key);
  if (hit) return Response.json(hit, { headers });

  try {
    if (mode === "count") {
      const result = await fetchOverpass(body.bounds, mode);
      return Response.json(remember(key, { count: result.count }), { headers });
    }

    const osmRequest = fetchOverpass(body.bounds, mode);
    const geoapifyRequest = env.GEOAPIFY_API_KEY
      ? fetchGeoapify(body.bounds, env.GEOAPIFY_API_KEY)
      : null;
    const [osmResult, geoapifyResult] = await Promise.allSettled([
      osmRequest,
      geoapifyRequest ?? Promise.resolve([] as PlaceResult[]),
    ]);
    const fromOsm = osmResult.status === "fulfilled"
      ? osmResult.value.elements.flatMap((element) => {
          const place = osmPlace(element);
          return place ? [place] : [];
        })
      : [];
    const fromGeoapify = env.GEOAPIFY_API_KEY && geoapifyResult.status === "fulfilled"
      ? geoapifyResult.value
      : [];
    const places = mergeProviderPlaces(fromOsm, fromGeoapify);
    if (!places.length && osmResult.status === "rejected" && (!env.GEOAPIFY_API_KEY || geoapifyResult.status === "rejected"))
      throw new Error("Both restaurant data providers failed");
    return Response.json(remember(key, { count: places.length, places }), { headers });
  } catch {
    return Response.json({ error: "Restaurant search is temporarily unavailable." }, { status: 502, headers });
  }
}

export function OPTIONS(): Response {
  return new Response(null, {
    headers: {
      ...headers,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
