import {
  canLoadMapRestaurants,
  discoveryBounds,
  isTorontoDemo,
  isTorontoOnly,
  osmRestaurants,
  withinBounds,
  type Bounds,
} from "../../../../packages/map-restaurants/index.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "no-store",
};
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: { ...headers, "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}

async function readJson(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response");
  const decoder = new TextDecoder();
  let text = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8_000_000) {
        await reader.cancel();
        throw new Error("Restaurant response too large");
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("bounds")?.split(",");
  if (!raw || raw.length !== 4 || raw.some((value) => !value.trim()))
    return Response.json(
      { error: "Send four map bounds." },
      { status: 400, headers },
    );
  const bounds = raw.map(Number) as [number, number, number, number];
  if (!canLoadMapRestaurants(bounds, 10))
    return Response.json(
      { error: "Zoom in to a city-sized area." },
      { status: 400, headers },
    );
  if (isTorontoOnly(bounds))
    return Response.json({ places: [], source: "csv-only" }, { headers });
  const area = discoveryBounds(bounds);
  if (!canLoadMapRestaurants(area, 10))
    return Response.json(
      { error: "Zoom in to a smaller area." },
      { status: 400, headers },
    );
  const cacheUrl = new URL("/api/map-restaurants", request.url);
  cacheUrl.searchParams.set("bounds", area.join(","));
  const cacheKey = new Request(cacheUrl.toString());
  // Cache API is available in Workers; plain Node tests can run without it.
  const cache = typeof caches === "undefined" ? undefined : caches.default;
  try {
    const hit = await cache?.match(cacheKey);
    if (hit) return hit;
  } catch {
    /* Cache outages must not prevent discovery. */
  }
  const [west, south, east, north] = area;
  const query = `[out:json][timeout:8];nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"]["name"](${south},${west},${north},${east});out center tags;`;
  for (const endpoint of [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
  ]) {
    if (request.signal.aborted) break;
    try {
      const upstream = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
      });
      if (!upstream.ok) {
        await upstream.body?.cancel();
        continue;
      }
      const data = await readJson(upstream);
      if (!Array.isArray(data?.elements) || data.remark) continue;
      const places = osmRestaurants(data.elements).filter(
        (place) => !isTorontoDemo(place) && withinBounds(place, area),
      );
      const response = Response.json(
        { places, source: "openstreetmap" },
        {
          headers: { ...headers, "Cache-Control": "public, max-age=600" },
        },
      );
      try {
        await cache?.put(cacheKey, response.clone());
      } catch {
        /* Best-effort cache. */
      }
      return response;
    } catch {
      /* Try the alternate provider without caching failures. */
    }
  }
  return Response.json(
    { error: "Restaurant discovery is temporarily unavailable. Please retry." },
    { status: 503, headers },
  );
}
