import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import {
  cancelAnimation,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
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
  type Coordinate,
} from "../models/discovery";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { CatalogPhoto } from "./CatalogPhoto";
import { catalogPhoto } from "../services/catalogPhotos";
import { CollectionProgress } from "./CollectionProgress";
import { AtlasGlobe, StarField, type RouteDotSpec } from "./AtlasGlobe";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { colors, discoveryColors as c } from "../../../theme";

type Motion =
  | {
      mode: "glide";
      from: number;
      to: number;
      startedAt: number;
      duration: number;
    }
  | { mode: "coast"; value: number; velocity: number; lastAt: number };

const COAST_STOP_VELOCITY = 12;

function shortestDelta(target: number, from: number) {
  return (((target - from) % 360) + 540) % 360 - 180;
}

export function CulinaryAtlas({
  entries,
  focusCuisine,
  focusNonce = 0,
  onExplore,
}: {
  entries: FoodEntry[];
  focusCuisine?: Cuisine | null;
  focusNonce?: number;
  onExplore: (cuisine: Cuisine) => void;
}) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const size = Math.min(320, Math.max(216, Math.round(width - 112)));

  const initial =
    focusCuisine && cuisineAnchors[focusCuisine]
      ? focusCuisine
      : (exploredCuisines(entries)[0] ?? "Japanese");
  const [selected, setSelected] = useState<Cuisine>(initial);

  // The globe poses live in one shared value driven from the UI thread; the
  // rAF animator keeps a JS mirror so gestures and glides hand over cleanly.
  const rotation = useSharedValue(cuisineAnchors[initial]?.[0] ?? 100);
  const estimateRef = useRef(rotation.value);
  const motionRef = useRef<Motion | null>(null);
  const frameRef = useRef<number | null>(null);
  const reducedRef = useRef(false);
  reducedRef.current = reduced === true;

  const reveal = useSharedValue(0);
  const litMask = useSharedValue(0);

  useEffect(() => {
    reducedRef.current = reduced === true;
  }, [reduced]);

  function stopMotion() {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    motionRef.current = null;
  }

  function tick() {
    const motion = motionRef.current;
    if (!motion) {
      frameRef.current = null;
      return;
    }
    const now = performance.now();
    let value: number;
    let settled: boolean;
    if (motion.mode === "glide") {
      const progress = Math.min(1, (now - motion.startedAt) / motion.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      value = motion.from + (motion.to - motion.from) * eased;
      settled = progress >= 1;
    } else {
      const dt = Math.min(48, Math.max(1, now - motion.lastAt));
      motion.lastAt = now;
      motion.velocity *= Math.pow(0.92, dt / 16.7);
      value = motion.value + (motion.velocity * dt) / 1000;
      motion.value = value;
      settled = Math.abs(motion.velocity) < COAST_STOP_VELOCITY;
    }
    rotation.value = value;
    estimateRef.current = value;
    frameRef.current = settled ? null : requestAnimationFrame(tick);
    if (settled) motionRef.current = null;
  }

  function beginMotion(motion: Motion) {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    motionRef.current = motion;
    frameRef.current = requestAnimationFrame(tick);
  }

  function drive(value: number) {
    stopMotion();
    rotation.value = value;
    estimateRef.current = value;
  }

  function spinBy(delta: number) {
    const target = estimateRef.current + delta;
    if (reducedRef.current) {
      drive(target);
      return;
    }
    beginMotion({
      mode: "glide",
      from: estimateRef.current,
      to: target,
      startedAt: performance.now(),
      duration: Math.min(720, 320 + Math.abs(delta) * 3),
    });
  }

  function select(cuisine: Cuisine) {
    setSelected(cuisine);
    const anchor = cuisineAnchors[cuisine];
    if (!anchor) {
      stopMotion();
      return;
    }
    const delta = shortestDelta(anchor[0], estimateRef.current);
    const target = estimateRef.current + delta;
    if (reducedRef.current || Math.abs(delta) < 0.2) {
      drive(target);
      return;
    }
    beginMotion({
      mode: "glide",
      from: estimateRef.current,
      to: target,
      startedAt: performance.now(),
      duration: Math.min(1000, 340 + Math.abs(delta) * 2.3),
    });
  }

  useEffect(() => stopMotion, []);

  // A linked focus (e.g. tapping a cuisine on a quest card) rotates without
  // remounting the whole globe. The nonce re-triggers even for the same cuisine.
  // Selecting is deferred a tick so no state updates run synchronously here.
  useEffect(() => {
    if (!focusCuisine || focusNonce === 0) return;
    const timer = setTimeout(() => select(focusCuisine), 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusCuisine, focusNonce]);

  const explored = useMemo(() => exploredCuisines(entries), [entries]);
  const exploredSet = useMemo(() => new Set(explored), [explored]);
  const connections = useMemo(() => cuisineConnections(selected), [selected]);
  const progress = useMemo(
    () => collectionProgress(entries, selected),
    [entries, selected],
  );
  const collected = useMemo(
    () => entries.filter((entry) => entry.cuisine === selected).length,
    [entries, selected],
  );
  const unlocked = exploredSet.has(selected);

  useEffect(() => {
    litMask.value = atlasCuisines.reduce((mask, cuisine, index) => {
      return exploredSet.has(cuisine) ? mask | (1 << index) : mask;
    }, 0);
  }, [exploredSet, litMask]);

  useEffect(() => {
    if (reduced === true) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withDelay(
      140,
      withTiming(1, { duration: 1500 }),
    );
    return () => cancelAnimation(reveal);
  }, [selected, reduced, reveal]);

  const routeSpecs = useMemo(() => {
    const from = cuisineAnchors[selected];
    if (!from) return [];
    const total = connections.length * 20;
    const specs: RouteDotSpec[] = [];
    let order = 0;
    for (const connection of connections) {
      const to = cuisineAnchors[connection.cuisine] as Coordinate | undefined;
      if (!to) continue;
      const delta = shortestDelta(to[0], from[0]);
      for (let i = 0; i < 20; i++) {
        const t = i / 19;
        specs.push({
          key: `${connection.cuisine}-${i}`,
          lon: from[0] + delta * t,
          lat:
            from[1] + (to[1] - from[1]) * t + Math.sin(t * Math.PI) * 12,
          order: order / Math.max(1, total - 1),
        });
        order++;
      }
    }
    return specs;
  }, [connections, selected]);

  function handleDragStart() {
    stopMotion();
    return estimateRef.current;
  }
  function handleDragMove(value: number) {
    rotation.value = value;
    estimateRef.current = value;
  }
  function handleDragRelease(velocity: number) {
    if (reducedRef.current || Math.abs(velocity) < 24) return;
    beginMotion({
      mode: "coast",
      value: estimateRef.current,
      velocity,
      lastAt: performance.now(),
    });
  }

  return (
    <View style={s.container}>
      <View style={s.sky}>
        <StarField reduced={reduced === true} />
        <View pointerEvents="none" style={s.auraSun}>
          <View style={s.auraSunCore} />
        </View>
        <View pointerEvents="none" style={s.auraEmber} />
        <View style={s.heading}>
          <View style={s.flex}>
            <Text style={s.eyebrow}>THE LIVING CULINARY ATLAS</Text>
            <Text style={s.title}>A world of first bites.</Text>
          </View>
          <View style={s.planetBadge}>
            <Ionicons
              name="planet-outline"
              size={24}
              color={c.glow}
              accessible={false}
            />
          </View>
        </View>
        <Text style={s.copy}>
          Every cuisine you discover leaves a little light on the map.
        </Text>
        <View style={s.globeRow}>
          <AtlasGlobe
            size={size}
            rotation={rotation}
            reveal={reveal}
            litMask={litMask}
            routeSpecs={routeSpecs}
            routesLive={routeSpecs.length > 0}
            explored={exploredSet}
            selected={selected}
            reduced={reduced === true}
            onSelectCuisine={select}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragRelease={handleDragRelease}
          />
        </View>
        <View style={s.globeControls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Rotate globe west"
            onPress={() => spinBy(-40)}
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
            onPress={() => spinBy(40)}
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
            accessibilityLabel={`${cuisine}, ${exploredSet.has(cuisine) ? "discovered" : "undiscovered"}`}
            accessibilityState={{ selected: selected === cuisine }}
            onPress={() => select(cuisine)}
            style={({ pressed }) => [
              s.chip,
              selected === cuisine && s.activeChip,
              pressed && s.dim,
            ]}
          >
            {exploredSet.has(cuisine) && (
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
  auraSun: {
    position: "absolute",
    top: 20,
    right: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  auraSunCore: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: "#263E5C90",
  },
  auraEmber: {
    position: "absolute",
    bottom: -56,
    left: -54,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: "#F4DB914D",
    opacity: 0.18,
  },
  heading: { flexDirection: "row", gap: 12, alignItems: "center" },
  planetBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: "#213554",
    shadowColor: c.land,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
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
    backgroundColor: "#FFFEFB0A",
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
