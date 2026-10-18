import type { ReactElement, Ref } from "react";
import type { Place } from "../../features/restaurants/data/places";
import type { Recommendations } from "../../features/restaurants/models/recommendations";
import type { SampleFriend } from "../../features/community/models/community";

export type MapCamera = {
  setCamera: (settings: {
    centerCoordinate: number[];
    zoomLevel: number;
    animationDuration: number;
  }) => void;
};
export type MapProps = {
  ref?: Ref<MapCamera>;
  token: string;
  center: number[];
  zoom: number;
  topInset: number;
  bottomInset: number;
  places: Place[];
  onViewportChange?: (
    bounds: [west: number, south: number, east: number, north: number],
    zoom: number,
  ) => void;
  currentLocation?: [number, number] | null;
  profilePictureUri?: string;
  themeAccent?: string;
  themeInk?: string;
  selectedId?: string;
  recommendations: Recommendations;
  friends?: SampleFriend[];
  onSelect: (place: Place) => void;
  onMapPress?: () => void;
  onReady: () => void;
  onError: () => void;
  renderPlaceMarker: (place: Place, selected: boolean) => ReactElement;
};
