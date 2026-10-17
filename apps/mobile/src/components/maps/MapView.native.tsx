import { useEffect, useImperativeHandle, useRef } from "react";
import { StyleSheet } from "react-native";
import Mapbox from "@rnmapbox/maps";
import type { MapProps } from "./types";

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (token) Mapbox.setAccessToken(token);

export default function MapView({ ref, ...props }: MapProps) {
  const camera = useRef<Mapbox.Camera>(null);
  useImperativeHandle(ref, () => ({ setCamera: (settings) => camera.current?.setCamera(settings) }), []);
  useEffect(() => { Mapbox.setAccessToken(props.token); }, [props.token]);
  return (
    <Mapbox.MapView
      style={StyleSheet.absoluteFill}
      styleURL={process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL || Mapbox.StyleURL.Light}
      scaleBarEnabled={false}
      compassEnabled={false}
      logoPosition={{ top: props.topInset + 205, left: 12 }}
      attributionPosition={{ top: props.topInset + 205, right: 12 }}
      onDidFinishLoadingMap={props.onReady}
      onMapLoadingError={props.onError}
    >
      <Mapbox.Camera ref={camera} defaultSettings={{ centerCoordinate: props.center, zoomLevel: props.zoom }}
        padding={{ paddingTop: props.topInset + 170, paddingBottom: props.bottomInset + 230, paddingLeft: 55, paddingRight: 55 }} />
      {props.places.map((place) => (
        <Mapbox.MarkerView key={place.id} id={place.id} coordinate={place.coordinate} allowOverlap isSelected={props.selectedId === place.id}>
          {props.renderMarker(place)}
        </Mapbox.MarkerView>
      ))}
    </Mapbox.MapView>
  );
}
