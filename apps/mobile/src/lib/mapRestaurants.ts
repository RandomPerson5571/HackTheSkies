import { apiEndpoint } from "./api.ts";
import type { Place } from "../features/restaurants/data/places";
import {
  discoveryBounds,
  type Bounds,
} from "../../../../packages/map-restaurants/index.ts";
export * from "../../../../packages/map-restaurants/index.ts";

export async function fetchMapRestaurants(
  bounds: Bounds,
  signal: AbortSignal,
): Promise<Place[]> {
  const endpoint = apiEndpoint("/api/map-restaurants");
  if (!endpoint)
    throw new Error(
      "Restaurant discovery is not connected. Configure the app’s API URL.",
    );
  const url = new URL(endpoint);
  url.searchParams.set("bounds", discoveryBounds(bounds).join(","));
  const response = await fetch(url.toString(), { signal });
  if (!response.ok)
    throw new Error(
      "Restaurants couldn’t load. Check your connection and try again.",
    );
  const data = await response.json();
  if (!Array.isArray(data.places))
    throw new Error("Restaurant discovery returned an invalid response.");
  return data.places;
}
