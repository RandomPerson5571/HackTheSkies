import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react";
import { StyleSheet } from "react-native";
import Mapbox from "@rnmapbox/maps";
import { colors } from "../../theme/index";
import {
  clusterMaxZoom,
  clusterRadius,
  createPlaceFeatures,
} from "./placeFeatures";
import type { MapProps } from "./types";
import { getMapMarkerPlaces } from "../../features/restaurants/models/recommendations";

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (token) Mapbox.setAccessToken(token);

// Selection and overlays must not re-serialize the source or rebuild its clusters.
const PlaceLayers = memo(function PlaceLayers({
  places,
  onSelect,
  camera,
  themeAccent,
  themeInk,
}: Pick<MapProps, "places" | "onSelect"> & {
  camera: RefObject<Mapbox.Camera | null>;
  themeAccent?: string;
  themeInk?: string;
}) {
  const source = useRef<Mapbox.ShapeSource>(null);
  const clusterRequest = useRef(0);
  const shape = useMemo(() => createPlaceFeatures(places), [places]);
  const placeIndex = useMemo(
    () => new Map(places.map((place) => [place.id, place])),
    [places],
  );
  useEffect(
    () => () => {
      clusterRequest.current += 1;
    },
    [places],
  );

  const onPress = useCallback<
    NonNullable<ComponentProps<typeof Mapbox.ShapeSource>["onPress"]>
  >(
    async ({ features }) => {
      const feature = features[0];
      if (!feature || feature.geometry.type !== "Point") return;
      if (feature.properties?.cluster) {
        const request = ++clusterRequest.current;
        const currentSource = source.current;
        try {
          const zoom = await currentSource?.getClusterExpansionZoom(feature);
          if (
            zoom === undefined ||
            request !== clusterRequest.current ||
            source.current !== currentSource
          )
            return;
          camera.current?.setCamera({
            centerCoordinate: feature.geometry.coordinates,
            zoomLevel: zoom,
            animationDuration: 250,
          });
        } catch {
          // A filter change can remove the cluster before the native query finishes.
        }
      } else {
        clusterRequest.current += 1;
        const place = placeIndex.get(feature.properties?.placeId);
        if (place) onSelect(place);
      }
    },
    [camera, onSelect, placeIndex],
  );

  return (
    <Mapbox.ShapeSource
      ref={source}
      id="places"
      shape={shape}
      cluster
      clusterRadius={clusterRadius}
      clusterMaxZoomLevel={clusterMaxZoom}
      hitbox={{ width: 44, height: 44 }}
      onPress={onPress}
    >
      <Mapbox.CircleLayer
        id="place-clusters"
        filter={["has", "point_count"]}
        style={{
          circleColor: themeAccent ?? colors.accent,
          circleRadius: ["step", ["get", "point_count"], 19, 50, 24, 200, 30],
          circleStrokeWidth: 2,
          circleStrokeColor: colors.white,
        }}
      />
      <Mapbox.SymbolLayer
        id="place-cluster-counts"
        filter={["has", "point_count"]}
        style={{
          textField: ["get", "point_count_abbreviated"],
          textSize: 13,
          textColor: colors.white,
          textAllowOverlap: true,
          textIgnorePlacement: true,
        }}
      />
      <Mapbox.CircleLayer
        id="place-points"
        filter={["!", ["has", "point_count"]]}
        style={{
          circleRadius: 7,
          circleColor: colors.accent,
          circleStrokeWidth: 2,
          circleStrokeColor: colors.white,
        }}
      />
      <Mapbox.SymbolLayer
        id="place-labels"
        minZoomLevel={14}
        filter={["!", ["has", "point_count"]]}
        style={{
          textField: ["get", "name"],
          textSize: 11,
          textAnchor: "top",
          textOffset: [0, 1],
          textMaxWidth: 10,
          textColor: themeInk ?? themeAccent ?? colors.ink,
          textHaloColor: colors.white,
          textHaloWidth: 2,
          textAllowOverlap: false,
        }}
      />
    </Mapbox.ShapeSource>
  );
});

export default memo(function MapView({ ref, ...props }: MapProps) {
  const camera = useRef<Mapbox.Camera>(null);
  const mapView = useRef<Mapbox.MapView>(null);
  const queryVersion = useRef(0);
  const [zoom, setZoom] = useState(props.zoom);
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(new Set());
  const refreshPhotoPins = useCallback(async () => {
    const version = ++queryVersion.current;
    try {
      const features = await mapView.current?.queryRenderedFeaturesInRect(
        [],
        [],
        ["place-points"],
      );
      if (version !== queryVersion.current || !features) return;
      const ids = new Set(
        features.features.flatMap((feature) =>
          typeof feature.properties?.placeId === "string"
            ? [feature.properties.placeId]
            : [],
        ),
      );
      setVisibleIds((previous) =>
        previous.size === ids.size && [...ids].every((id) => previous.has(id))
          ? previous
          : ids,
      );
    } catch {
      // Layers may not exist yet while the map style is loading.
    }
  }, []);
  useEffect(() => {
    void refreshPhotoPins();
    return () => {
      queryVersion.current += 1;
    };
  }, [props.places, refreshPhotoPins]);
  const markers = useMemo(
    () =>
      getMapMarkerPlaces(
        props.places,
        visibleIds,
        props.recommendations,
        props.selectedId,
        zoom,
      ),
    [props.places, visibleIds, props.recommendations, props.selectedId, zoom],
  );
  const defaultSettings = useMemo(
    () => ({ centerCoordinate: props.center, zoomLevel: props.zoom }),
    [props.center, props.zoom],
  );
  const padding = useMemo(
    () => ({
      paddingTop: props.topInset + 170,
      paddingBottom: props.bottomInset + 230,
      paddingLeft: 55,
      paddingRight: 55,
    }),
    [props.topInset, props.bottomInset],
  );
  useImperativeHandle(
    ref,
    () => ({ setCamera: (settings) => camera.current?.setCamera(settings) }),
    [],
  );
  useEffect(() => {
    Mapbox.setAccessToken(props.token);
  }, [props.token]);
  return (
    <Mapbox.MapView
      ref={mapView}
      onMapIdle={(state) => {
        setZoom(state.properties.zoom);
        props.onViewportChange?.(
          [
            state.properties.bounds.sw[0]!,
            state.properties.bounds.sw[1]!,
            state.properties.bounds.ne[0]!,
            state.properties.bounds.ne[1]!,
          ],
          state.properties.zoom,
        );
        refreshPhotoPins();
      }}
      style={StyleSheet.absoluteFill}
      styleURL={
        process.env.EXPO_PUBLIC_MAPBOX_STYLE_URL || Mapbox.StyleURL.Light
      }
      attributionEnabled={false}
      logoEnabled={false}
      scaleBarEnabled={false}
      compassEnabled={false}
      onPress={(event) => {
        const { screenPointX, screenPointY } = event.properties;
        void mapView.current
          ?.queryRenderedFeaturesInRect(
            [
              screenPointY - 22,
              screenPointX - 22,
              screenPointY + 22,
              screenPointX + 22,
            ],
            [],
            ["place-points"],
          )
          .then((result) => {
            if (
              !result?.features.some((feature) => feature.properties?.placeId)
            )
              props.onMapPress?.();
          })
          .catch(() => props.onMapPress?.());
      }}
      onDidFinishLoadingMap={props.onReady}
      onMapLoadingError={props.onError}
    >
      <Mapbox.Camera
        ref={camera}
        defaultSettings={defaultSettings}
        padding={padding}
      />
      <PlaceLayers
        places={props.places}
        onSelect={props.onSelect}
        camera={camera}
        themeAccent={props.themeAccent}
        themeInk={props.themeInk}
      />
      {markers.map((place) => (
        <Mapbox.MarkerView
          key={place.id}
          id={place.id}
          coordinate={place.coordinate}
          allowOverlap={place.id === props.selectedId}
          isSelected={place.id === props.selectedId}
        >
          {props.renderPlaceMarker(place, place.id === props.selectedId)}
        </Mapbox.MarkerView>
      ))}
    </Mapbox.MapView>
  );
});
