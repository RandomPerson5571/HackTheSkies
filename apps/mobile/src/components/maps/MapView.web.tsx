import {
  memo,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { colors } from "../../theme/index";
import {
  clusterMaxZoom,
  clusterRadius,
  createPlaceFeatures,
  type PlaceFeatures,
} from "./placeFeatures";
import type { MapProps } from "./types";
import { getMapMarkerPlaces } from "../../features/restaurants/models/recommendations";

// mapbox-gl v2 ships without TypeScript declarations in this app.
// @ts-expect-error No declaration file for the installed mapbox-gl package.
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

type MapPoint = { x: number; y: number };
type MapFeature = GeoJSON.Feature<
  GeoJSON.Point,
  {
    placeId?: string;
    cluster?: boolean;
    cluster_id?: number;
  }
>;
type PlaceSource = {
  setData: (data: PlaceFeatures) => void;
  getClusterExpansionZoom: (
    id: number,
    callback: (error: Error | null, zoom: number) => void,
  ) => void;
};
type WebMap = {
  flyTo: (options: {
    center: number[];
    zoom: number;
    duration: number;
  }) => void;
  on(event: "load" | "error" | "idle", callback: () => void): void;
  on(event: "click", callback: (event: { point: MapPoint }) => void): void;
  on(
    event: "mouseenter" | "mouseleave",
    layer: string,
    callback: () => void,
  ): void;
  addSource: (
    id: string,
    options: {
      type: "geojson";
      data: PlaceFeatures;
      cluster: boolean;
      clusterRadius: number;
      clusterMaxZoom: number;
    },
  ) => void;
  getSource: (id: string) => PlaceSource | undefined;
  addLayer: (layer: {
    id: string;
    type: "circle" | "symbol";
    source: string;
    filter: unknown[];
    minzoom?: number;
    paint?: Record<string, unknown>;
    layout?: Record<string, unknown>;
  }) => void;
  queryRenderedFeatures(
    bounds: [number[], number[]],
    options: { layers: string[] },
  ): MapFeature[];
  queryRenderedFeatures(options: { layers: string[] }): MapFeature[];
  getCanvas: () => HTMLCanvasElement;
  remove: () => void;
};

export default memo(function MapView({ ref, ...props }: MapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<WebMap | null>(null);
  const latest = useRef(props);
  const data = useMemo(() => createPlaceFeatures(props.places), [props.places]);
  const placeIndex = useMemo(
    () => new Map(props.places.map((place) => [place.id, place])),
    [props.places],
  );
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(new Set());
  const markers = useMemo(
    () =>
      getMapMarkerPlaces(
        props.places,
        visibleIds,
        props.recommendations,
        props.selectedId,
      ),
    [props.places, visibleIds, props.recommendations, props.selectedId],
  );
  const currentData = useRef({ data, placeIndex });
  useEffect(() => {
    latest.current = props;
    currentData.current = { data, placeIndex };
  });
  useImperativeHandle(
    ref,
    () => ({
      setCamera: (settings) =>
        map.current?.flyTo({
          center: settings.centerCoordinate,
          zoom: settings.zoomLevel,
          duration: settings.animationDuration,
        }),
    }),
    [],
  );

  useEffect(() => {
    if (!container.current) return;
    let instance: WebMap | undefined;
    let disposed = false;
    let clusterRequest = 0;
    try {
      const currentMap: WebMap = new mapboxgl.Map({
        container: container.current,
        accessToken: props.token,
        style:
          process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL ||
          "mapbox://styles/mapbox/light-v11",
        center: latest.current.center,
        zoom: latest.current.zoom,
      });
      instance = currentMap;
      map.current = currentMap;
      currentMap.on("load", () => {
        if (disposed) return;
        currentMap.addSource("places", {
          type: "geojson",
          data: currentData.current.data,
          cluster: true,
          clusterRadius,
          clusterMaxZoom,
        });
        currentMap.addLayer({
          id: "place-clusters",
          type: "circle",
          source: "places",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": colors.accent,
            "circle-radius": [
              "step",
              ["get", "point_count"],
              19,
              50,
              24,
              200,
              30,
            ],
            "circle-stroke-width": 2,
            "circle-stroke-color": colors.white,
          },
        });
        currentMap.addLayer({
          id: "place-cluster-counts",
          type: "symbol",
          source: "places",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
            "text-allow-overlap": true,
            "text-ignore-placement": true,
          },
          paint: { "text-color": colors.white },
        });
        currentMap.addLayer({
          id: "place-points",
          type: "circle",
          source: "places",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 7,
            "circle-color": colors.accent,
            "circle-stroke-width": 2,
            "circle-stroke-color": colors.white,
          },
        });
        currentMap.addLayer({
          id: "place-labels",
          type: "symbol",
          source: "places",
          minzoom: 14,
          filter: ["!", ["has", "point_count"]],
          layout: {
            "text-field": ["get", "name"],
            "text-size": 11,
            "text-anchor": "top",
            "text-offset": [0, 1],
            "text-max-width": 10,
            "text-allow-overlap": false,
          },
          paint: {
            "text-color": colors.ink,
            "text-halo-color": colors.white,
            "text-halo-width": 2,
          },
        });
        currentMap.on("click", ({ point }) => {
          const feature = currentMap.queryRenderedFeatures(
            [
              [point.x - 22, point.y - 22],
              [point.x + 22, point.y + 22],
            ],
            { layers: ["place-clusters", "place-points", "place-labels"] },
          )[0];
          if (!feature || feature.geometry.type !== "Point") return;
          const request = ++clusterRequest;
          if (
            feature.properties.cluster &&
            feature.properties.cluster_id !== undefined
          ) {
            const requestedData = currentData.current.data;
            currentMap
              .getSource("places")
              ?.getClusterExpansionZoom(
                feature.properties.cluster_id,
                (error, zoom) => {
                  if (
                    error ||
                    disposed ||
                    request !== clusterRequest ||
                    requestedData !== currentData.current.data
                  )
                    return;
                  currentMap.flyTo({
                    center: feature.geometry.coordinates,
                    zoom,
                    duration: 250,
                  });
                },
              );
          } else {
            const place = currentData.current.placeIndex.get(
              feature.properties.placeId ?? "",
            );
            if (place) latest.current.onSelect(place);
          }
        });
        for (const layer of [
          "place-clusters",
          "place-points",
          "place-labels",
        ]) {
          currentMap.on("mouseenter", layer, () => {
            currentMap.getCanvas().style.cursor = "pointer";
          });
          currentMap.on("mouseleave", layer, () => {
            currentMap.getCanvas().style.cursor = "";
          });
        }
        currentMap.on("idle", () => {
          if (disposed) return;
          const features = currentMap.queryRenderedFeatures({
            layers: ["place-points"],
          });
          const ids = new Set(
            features.flatMap((feature) =>
              feature.properties.placeId ? [feature.properties.placeId] : [],
            ),
          );
          setVisibleIds((previous) =>
            previous.size === ids.size &&
            [...ids].every((id) => previous.has(id))
              ? previous
              : ids,
          );
        });
        latest.current.onReady();
      });
      currentMap.on("error", () => {
        if (!disposed) latest.current.onError();
      });
    } catch {
      latest.current.onError();
    }
    return () => {
      disposed = true;
      map.current = null;
      instance?.remove();
    };
  }, [props.token]);

  // Only a filter/data change updates the worker source. Selecting a pin does not.
  useEffect(() => {
    map.current?.getSource("places")?.setData(data);
  }, [data, props.token]);

  // Reconcile a bounded set of photo pins. Panning/selection never recreates all pins.
  const markerCache = useRef(new Map<string, { remove: () => void }>());
  useEffect(() => {
    const cache = markerCache.current;
    return () => {
      cache.forEach((marker) => marker.remove());
      cache.clear();
    };
  }, [props.token]);
  useEffect(() => {
    if (!map.current) return;
    const cache = markerCache.current;
    const desired = new Set(
      markers.map(
        (place) =>
          `${place.id}:${props.recommendations.get(place.id)?.suggested ? "photo" : "plain"}:${place.id === props.selectedId}`,
      ),
    );
    for (const [key, marker] of cache) {
      if (!desired.has(key)) {
        marker.remove();
        cache.delete(key);
      }
    }
    for (const place of markers) {
      const suggested = props.recommendations.get(place.id)?.suggested ?? false;
      const selected = place.id === props.selectedId;
      const key = `${place.id}:${suggested ? "photo" : "plain"}:${selected}`;
      if (cache.has(key)) continue;
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute(
        "aria-label",
        `${suggested ? "Suggested: " : ""}View ${place.name}, ${place.category}`,
      );
      button.setAttribute("aria-pressed", String(selected));
      Object.assign(button.style, {
        padding: "4px",
        borderRadius: "15px",
        border: `${selected ? 3 : 2}px solid ${colors.accent}`,
        background: colors.white,
        color: colors.ink,
        cursor: "pointer",
        maxWidth: "140px",
        fontSize: "11px",
        fontWeight: "600",
      });
      if (suggested) {
        const image = document.createElement("img");
        image.src = place.image;
        image.alt = "";
        image.width = 58;
        image.height = 58;
        image.decoding = "async";
        Object.assign(image.style, {
          display: "block",
          objectFit: "cover",
          borderRadius: "8px",
          margin: "0 auto 4px",
        });
        button.append(image);
      }
      button.append(
        document.createTextNode(
          `${suggested ? "Suggested · " : ""}${place.name}`,
        ),
      );
      button.onclick = (event) => {
        event.stopPropagation();
        latest.current.onSelect(place);
      };
      const marker = new mapboxgl.Marker({ element: button })
        .setLngLat(place.coordinate)
        .addTo(map.current);
      cache.set(key, marker);
    }
  }, [markers, props.recommendations, props.selectedId, props.token]);

  return <div ref={container} style={{ position: "absolute", inset: 0 }} />;
});
