import type { ReactElement, Ref } from "react";
import type { Place } from "../../features/restaurants/data/places";

export type MapCamera = {
  setCamera: (settings: { centerCoordinate: number[]; zoomLevel: number; animationDuration: number }) => void;
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
  onSelect: (place: Place) => void;
  onReady: () => void;
  onError: () => void;
  renderMarker: (place: Place) => ReactElement;
};
