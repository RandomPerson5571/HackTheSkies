import {
  isValidCoordinate,
  type Place,
} from "../../features/restaurants/data/places";

export const clusterRadius = 50;
export const clusterMaxZoom = 14;

export type PlaceFeatures = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  { placeId: string; name: string }
>;

// Keep photos and restaurant details out of the map's worker/native data source.
// The full place is looked up only when a point is selected.
export function createPlaceFeatures(places: readonly Place[]): PlaceFeatures {
  return {
    type: "FeatureCollection",
    // MapboxGL rejects coordinate arrays that are not finite numbers.
    features: places
      .filter((place) => isValidCoordinate(place.coordinate))
      .map((place) => ({
        type: "Feature",
        id: place.id,
        geometry: { type: "Point", coordinates: place.coordinate },
        properties: { placeId: place.id, name: place.name },
      })),
  };
}
