import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  cuisineCovers,
  cuisineRegions,
  type Cuisine,
  type FoodEntry,
} from "../models/foodDex";
import {
  atlasCuisines,
  collectionProgress,
  cuisineAnchors,
  cuisineConnections,
  exploredCuisines,
  project,
  type Coordinate,
} from "../models/discovery";
import { landDots } from "../data/globeLand";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { CatalogPhoto } from "./CatalogPhoto";
import { catalogPhoto } from "../services/catalogPhotos";
import { CollectionProgress } from "./CollectionProgress";
import { colors, discoveryColors as c } from "../../../theme";

const SIZE = 276;
const grid: Coordinate[] = [];
for (let lat = -60; lat <= 60; lat += 30)
  for (let lon = -180; lon < 180; lon += 8) grid.push([lon, lat]);
for (let lon = -180; lon < 180; lon += 30)
  for (let lat = -80; lat <= 80; lat += 8) grid.push([lon, lat]);

export function CulinaryAtlas({
  entries,
  focusCuisine,
  onExplore,
}: {
  entries: FoodEntry[];
  focusCuisine?: Cuisine | null;
  onExplore: (cuisine: Cuisine) => void;
}) {
  const initial =
    focusCuisine && cuisineAnchors[focusCuisine]
      ? focusCuisine
      : (exploredCuisines(entries)[0] ?? "Japanese");
  const [selected, setSelected] = useState<Cuisine>(initial);
  const [rotation, setRotation] = useState(cuisineAnchors[initial]?.[0] ?? 100);
  const rotationRef = useRef(rotation);
  const dragStart = useRef(rotation);
  const reduced = useReducedMotion();
  const [routeAnimation] = useState(() => new Animated.Value(0));
  const connections = useMemo(() => cuisineConnections(selected), [selected]);
  const explored = exploredCuisines(entries);
  const unlocked = explored.includes(selected);
  const progress = collectionProgress(entries, selected);
  const collected = entries.filter(
    (entry) => entry.cuisine === selected,
  ).length;
  const [pan] = useState(
    // PanResponder stores these handlers; refs are only read during gestures.
    // eslint-disable-next-line react-hooks/refs
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderGrant: () => {
          dragStart.current = rotationRef.current;
        },
        onPanResponderMove: (_, gesture) => {
          const next = dragStart.current - gesture.dx * 0.55;
          rotationRef.current = next;
          setRotation(next);
        },
      }),
  );
  useEffect(() => {
    if (reduced === null) return;
    routeAnimation.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.timing(routeAnimation, {
      toValue: 1,
      duration: 1050,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [selected, reduced, routeAnimation]);

  function select(cuisine: Cuisine) {
    setSelected(cuisine);
    const next = cuisineAnchors[cuisine]?.[0] ?? rotationRef.current;
    rotationRef.current = next;
    setRotation(next);
  }
  function rotate(delta: number) {
    rotationRef.current += delta;
    setRotation(rotationRef.current);
  }
  const from = cuisineAnchors[selected]!;
  const routes = connections.flatMap((connection) => {
    const to = cuisineAnchors[connection.cuisine]!;
    // Interpolate across the shortest longitude span, lifting the route northward.
    const delta = ((to[0] - from[0] + 540) % 360) - 180;
    return Array.from({ length: 20 }, (_, i) => {
      const t = i / 19;
      const point = project(
        [
          from[0] + delta * t,
          from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 12,
        ],
        rotation,
      );
      return { ...point, key: `${connection.cuisine}-${i}`, t };
    });
  });
  return (
    <View style={s.container}>
      <View style={s.sky}>
        <View style={s.heading}>
          <View style={s.flex}>
            <Text style={s.eyebrow}>THE LIVING CULINARY ATLAS</Text>
            <Text style={s.title}>A world of first bites.</Text>
          </View>
          <Ionicons
            name="planet-outline"
            size={28}
            color={c.glow}
            accessible={false}
          />
        </View>
        <Text style={s.copy}>
          Every cuisine you discover leaves a little light on the map.
        </Text>
        <View style={s.globeRow}>
          <View
            {...pan.panHandlers}
            style={s.globe}
            accessibilityLabel="Illustrated culinary globe. Use the region buttons below to explore."
            accessibilityRole="image"
          >
            <View
              pointerEvents="none"
              accessible={false}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={StyleSheet.absoluteFill}
            >
              {grid.map((coordinate, i) => {
                const p = project(coordinate, rotation);
                return p.visible ? (
                  <View
                    key={`grid-${i}`}
                    style={[s.gridDot, { left: p.x, top: p.y }]}
                  />
                ) : null;
              })}
              {landDots.map((coordinate, i) => {
                const p = project(coordinate, rotation);
                return p.visible ? (
                  <View
                    key={`land-${i}`}
                    style={[
                      s.landDot,
                      { left: p.x - 1.5, top: p.y - 1.5 },
                      explored.some((cuisine) => {
                        const anchor = cuisineAnchors[cuisine]!;
                        const dx =
                          (((coordinate[0] - anchor[0] + 540) % 360) - 180) *
                          Math.cos((anchor[1] * Math.PI) / 180);
                        return dx * dx + (coordinate[1] - anchor[1]) ** 2 < 150;
                      }) && s.litLandDot,
                    ]}
                  />
                ) : null;
              })}
              {routes.map((point) =>
                point.visible ? (
                  <Animated.View
                    key={point.key}
                    style={[
                      s.routeDot,
                      {
                        left: point.x,
                        top: point.y,
                        opacity: routeAnimation.interpolate({
                          inputRange: [
                            Math.max(0, point.t - 0.1),
                            Math.min(1, point.t + 0.1),
                          ],
                          outputRange: [0, 0.8],
                          extrapolate: "clamp",
                        }),
                      },
                    ]}
                  />
                ) : null,
              )}
              {atlasCuisines.map((cuisine) => {
                const p = project(cuisineAnchors[cuisine]!, rotation);
                if (!p.visible) return null;
                const lit = explored.includes(cuisine);
                return (
                  <View
                    key={cuisine}
                    style={[
                      s.pinHalo,
                      { left: p.x - 9, top: p.y - 9 },
                      lit && s.litHalo,
                      cuisine === selected && s.selectedHalo,
                    ]}
                  >
                    <View
                      style={[
                        s.pin,
                        lit && s.litPin,
                        cuisine === selected && s.selectedPin,
                      ]}
                    />
                  </View>
                );
              })}
            </View>
          </View>
        </View>
        <View style={s.globeControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate globe west"
            onPress={() => rotate(-40)}
            style={({ pressed }) => [s.rotateButton, pressed && s.dim]}
          >
            <Ionicons
              name="arrow-back"
              size={18}
              color={c.light}
              accessible={false}
            />
          </Pressable>
          <Text style={s.hint}>DRAG TO EXPLORE</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate globe east"
            onPress={() => rotate(40)}
            style={({ pressed }) => [s.rotateButton, pressed && s.dim]}
          >
            <Ionicons
              name="arrow-forward"
              size={18}
              color={c.light}
              accessible={false}
            />
          </Pressable>
        </View>
        <View style={s.legend}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: c.glow }]} />
            <Text style={s.legendText}>
              {explored.length} {explored.length === 1 ? "cuisine" : "cuisines"}{" "}
              illuminated
            </Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, { backgroundColor: c.land }]} />
            <Text style={s.legendText}>
              {atlasCuisines.length - explored.length} awaiting you
            </Text>
          </View>
        </View>
      </View>
      <Text style={s.label}>CHOOSE A CUISINE</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {atlasCuisines.map((cuisine) => (
          <Pressable
            key={cuisine}
            accessibilityRole="button"
            accessibilityLabel={`${cuisine}, ${explored.includes(cuisine) ? "discovered" : "undiscovered"}`}
            accessibilityState={{ selected: selected === cuisine }}
            onPress={() => select(cuisine)}
            style={({ pressed }) => [
              s.chip,
              selected === cuisine && s.activeChip,
              pressed && s.dim,
            ]}
          >
            {explored.includes(cuisine) && (
              <Ionicons
                name="checkmark-circle"
                size={14}
                color={selected === cuisine ? colors.white : colors.accent}
                accessible={false}
              />
            )}
            <Text style={[s.chipText, selected === cuisine && s.activeText]}>
              {cuisine}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <View accessibilityLiveRegion="polite" style={s.region}>
        <View style={s.regionHeading}>
          <CatalogPhoto
            source={catalogPhoto(cuisineCovers[selected])}
            label={selected}
            style={s.thumbnail}
          />
          <View style={s.flex}>
            <Text style={s.label}>
              {unlocked ? "ILLUMINATED BY YOU" : "YOUR NEXT CHAPTER"}
            </Text>
            <Text style={s.regionTitle}>{selected}</Text>
            <Text style={s.body}>{cuisineRegions[selected].join(" · ")}</Text>
          </View>
        </View>
        <View style={s.progressRow}>
          <Text style={s.body}>{collected} collected</Text>
          <Text style={s.body}>
            {progress.collected} / {progress.total} catalog dishes
          </Text>
        </View>
        <CollectionProgress value={progress.fraction} />
        <Pressable
          accessibilityRole="button"
          onPress={() => onExplore(selected)}
          style={({ pressed }) => [s.explore, pressed && s.dim]}
        >
          <Text style={s.exploreText}>Explore {selected} dishes</Text>
          <Ionicons
            name="arrow-forward"
            size={18}
            color={colors.white}
            accessible={false}
          />
        </Pressable>
      </View>
      <View style={s.connections}>
        <Text style={s.regionTitle}>Follow the flavor.</Text>
        <Text style={s.body}>
          Find a familiar ingredient or cooking style somewhere new.
        </Text>
        {connections.map((connection) => {
          const shared = connection.shared[0]!;
          return (
            <Pressable
              key={connection.cuisine}
              accessibilityRole="button"
              accessibilityLabel={`${shared.theme}: ${shared.from.name} connects to ${shared.to.name}. Explore ${connection.cuisine}`}
              onPress={() => select(connection.cuisine)}
              style={({ pressed }) => [s.connection, pressed && s.dim]}
            >
              <View style={s.connectionIcon}>
                <Ionicons
                  name="git-network-outline"
                  size={20}
                  color={colors.accent}
                  accessible={false}
                />
              </View>
              <View style={s.flex}>
                <Text style={s.connectionTitle}>
                  {shared.theme} · {connection.cuisine}
                </Text>
                <Text style={s.body}>
                  {shared.from.name} → {shared.to.name}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.accent}
                accessible={false}
              />
            </Pressable>
          );
        })}
        <Text style={s.footnote}>
          An illustrated atlas of culinary regions, which can span borders.
          Connections highlight shared food themes, not historical origins.
          Discoveries in “Other” stay in your collection.
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  container: { gap: 16 },
  flex: { flex: 1 },
  dim: { opacity: 0.65 },
  sky: {
    backgroundColor: c.night,
    borderRadius: 28,
    padding: 20,
    overflow: "hidden",
    gap: 14,
  },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  eyebrow: {
    color: c.glow,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.7,
    marginBottom: 10,
  },
  title: {
    color: c.light,
    fontSize: 25,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  copy: { color: c.muted, fontSize: 13, lineHeight: 21, maxWidth: 340 },
  globeRow: { alignItems: "center", marginVertical: 4 },
  globe: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.ocean,
    overflow: "hidden",
  },
  gridDot: {
    position: "absolute",
    width: 1,
    height: 1,
    backgroundColor: c.line,
  },
  landDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.land,
  },
  litLandDot: { backgroundColor: c.glow, width: 4, height: 4 },
  routeDot: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.gold,
  },
  pinHalo: {
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  litHalo: { backgroundColor: "#EAF3B226" },
  selectedHalo: {
    borderWidth: 1,
    borderColor: c.gold,
    backgroundColor: "#F4DB9133",
  },
  pin: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.land },
  litPin: { backgroundColor: c.glow, width: 7, height: 7, borderRadius: 4 },
  selectedPin: { backgroundColor: c.gold },
  globeControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  rotateButton: {
    minWidth: 44,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { color: c.muted, fontSize: 9, letterSpacing: 1.6, fontWeight: "600" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    borderTopWidth: 1,
    borderColor: c.line,
    paddingTop: 16,
  },
  legendItem: { flexDirection: "row", gap: 6, alignItems: "center" },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 10, color: c.muted },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: colors.muted,
  },
  chips: { gap: 8, paddingBottom: 4 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  activeChip: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 12, color: colors.ink, fontWeight: "600" },
  activeText: { color: colors.white },
  region: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  regionHeading: { flexDirection: "row", gap: 14, alignItems: "center" },
  thumbnail: { width: 68, height: 80, borderRadius: 16 },
  regionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  body: { fontSize: 12, lineHeight: 20, color: colors.muted },
  progressRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  explore: {
    minHeight: 48,
    padding: 14,
    borderRadius: 24,
    backgroundColor: colors.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exploreText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
    flexShrink: 1,
  },
  connections: { gap: 8 },
  connection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionTitle: { fontSize: 13, fontWeight: "600", color: colors.ink },
  footnote: {
    fontSize: 11,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 12,
  },
});
