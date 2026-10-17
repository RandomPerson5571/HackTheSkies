import { useEffect, useImperativeHandle, useRef } from "react";
import type { MapProps } from "./types";

// mapbox-gl v2 ships without TypeScript declarations in this app.
// @ts-expect-error No declaration file for the installed mapbox-gl package.
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type WebMap = {
  flyTo: (options: { center: number[]; zoom: number; duration: number }) => void;
  on: (event: string, callback: () => void) => void;
  remove: () => void;
};

export default function MapView({ ref, ...props }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<WebMap | null>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  useImperativeHandle(ref, () => ({
    setCamera: (settings) => map.current?.flyTo({ center: settings.centerCoordinate, zoom: settings.zoomLevel, duration: settings.animationDuration }),
  }), []);
  useEffect(() => {
    if (!container.current) return;
    try {
      const instance: WebMap = new mapboxgl.Map({
        container: container.current,
        accessToken: props.token,
        style: process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL || "mapbox://styles/mapbox/light-v11",
        center: latest.current.center,
        zoom: latest.current.zoom,
      });
      map.current = instance;
      instance.on("load", () => latest.current.onReady());
      instance.on("error", () => latest.current.onError());
      return () => { map.current = null; instance.remove(); };
    } catch { latest.current.onError(); }
  }, [props.token]);
  useEffect(() => {
    if (!map.current) return;
    const markers = props.places.map((place) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `View ${place.name}, ${place.category}`);
      button.setAttribute("aria-pressed", String(props.selectedId === place.id));
      button.textContent = place.name;
      Object.assign(button.style, { padding: "8px 12px", borderRadius: "20px", border: props.selectedId === place.id ? "3px solid #d56138" : "1px solid #ccc", background: "white", cursor: "pointer" });
      button.onclick = () => latest.current.onSelect(place);
      return new mapboxgl.Marker({ element: button }).setLngLat(place.coordinate).addTo(map.current);
    });
    return () => { markers.forEach((marker) => marker.remove()); };
  }, [props.places, props.selectedId, props.token]);
  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
}
