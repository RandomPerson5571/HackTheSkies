import type { ReactElement, Ref } from "react";
import type { Place } from "../../features/restaurants/data/places";
import type { Recommendations } from "../../features/restaurants/models/recommendations";

export type MapCamera = {
  centerOnUserLocation: () => void;
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
  selectedId?: string;
  recommendations: Recommendations;
  onSelect: (place: Place) => void;
  onReady: () => void;
  onError: () => void;
  renderPlaceMarker: (place: Place, selected: boolean) => ReactElement;
};
