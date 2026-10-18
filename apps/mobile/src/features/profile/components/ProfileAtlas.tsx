import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { useEffect, useMemo, useState } from "react";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../theme";
import {
  atlasCuisines,
  cuisineMastery,
} from "../../food-dex/models/discovery";
import {
  cuisineCovers,
  cuisineRegions,
  dishes,
  type Cuisine,
  type FoodEntry,
} from "../../food-dex/models/foodDex";
import { CatalogPhoto } from "../../food-dex/components/CatalogPhoto";
import { catalogPhoto } from "../../food-dex/services/catalogPhotos";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";
import {
  atlasProgress,
  atlasSvg,
  countryAtPoint,
  cuisineAtPoint,
} from "../models/culinaryAtlas";

export function ProfileAtlas({
  entries,
  onOpenDex,
}: {
  entries: FoodEntry[];
  onOpenDex?: () => void;
}) {
  const [selected, setSelected] = useState<Cuisine | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [mapWidth, setMapWidth] = useState(0);
  const [mapHeight, setMapHeight] = useState(0);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const rows = useMemo(
    () => atlasCuisines.map((cuisine) => atlasProgress(entries, cuisine)),
    [entries],
  );
  const discovered = rows.filter((row) => row.discoveries > 0);
  const next =
    rows.find((row) => row.discoveries === 0) ??
    rows.find((row) => row.fraction < 1) ??
    rows[0]!;
  const svg = useMemo(
    () => ({
      uri: `data:image/svg+xml;utf8,${encodeURIComponent(atlasSvg(entries, selectedCountry, selected))}`,
    }),
    [entries, selectedCountry, selected],
  );
  const [mapOpacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (reduced !== false) {
      mapOpacity.setValue(1);
      return;
    }
    mapOpacity.setValue(0.45);
    const animation = Animated.timing(mapOpacity, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [svg, reduced, mapOpacity]);
  const active = selected
    ? rows.find((row) => row.cuisine === selected)
    : undefined;
  const suggestions = selected
    ? dishes.filter((dish) => dish.cuisineIds.includes(selected)).slice(0, 6)
    : [];
  const mastery = active
    ? cuisineMastery(active.collected.length, active.total)
    : null;
  const detailDishes = active?.collected.length
    ? active.collected.slice(0, 6)
    : suggestions;
  return (
    <View style={s.card}>
      <View style={s.heading}>
        <View style={s.flex}>
          <Text accessibilityRole="header" style={s.title}>
            Culinary Atlas
          </Text>
        </View>
        <View style={s.compass}>
          <Ionicons name="compass-outline" size={20} color={colors.accent} />
        </View>
      </View>
      <Text style={s.small}>Tap the map or a cuisine to explore.</Text>
      <Animated.View style={[s.mapSurface, { opacity: mapOpacity }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Interactive culinary world map"
          accessibilityHint="Tap a country to explore its closest cuisine and your discoveries."
          onLayout={(event) => {
            setMapWidth(event.nativeEvent.layout.width);
            setMapHeight(event.nativeEvent.layout.height);
          }}
          onPress={(event) => {
            if (!mapWidth || !mapHeight) return;
            const x = (event.nativeEvent.locationX / mapWidth) * 720;
            const y = (event.nativeEvent.locationY / mapHeight) * 390;
            const country = countryAtPoint(x, y);
            const cuisine = cuisineAtPoint(x, y);
            if (country && cuisine) {
              setSelectedCountry(country);
              setSelected(cuisine);
            }
          }}
          style={({ pressed }) => [s.map, pressed && s.mapPressed]}
        >
          <Image
            source={svg}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            accessible={false}
          />
        </Pressable>
      </Animated.View>
      <View style={s.progressHeader}>
        <Text style={s.subtitle}>Cuisine progress</Text>
        <Text style={s.progressText}>
          {discovered.length} / {atlasCuisines.length} cuisines
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{
          min: 0,
          max: atlasCuisines.length,
          now: discovered.length,
        }}
        accessibilityLabel="Cuisines discovered"
        style={s.track}
      >
        <View
          style={[
            s.fill,
            { width: `${(discovered.length / atlasCuisines.length) * 100}%` },
          ]}
        />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
      >
        {rows.map((row) => (
          <Pressable
            key={row.cuisine}
            accessibilityRole="button"
            accessibilityLabel={`${row.cuisine}, ${row.discoveries ? `${row.discoveries} discoveries` : "undiscovered"}`}
            onPress={() => {
              setSelectedCountry(null);
              setSelected(row.cuisine);
            }}
            style={({ pressed }) => [
              s.chip,
              row.discoveries > 0 && s.unlockedChip,
              pressed && s.pressed,
            ]}
          >
            <Ionicons
              name={row.discoveries ? "checkmark-circle" : "compass-outline"}
              size={15}
              color={colors.accent}
            />
            <Text style={s.chipText}>{row.cuisine}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next adventure: explore ${next.cuisine} cuisine`}
        onPress={() => {
          setSelectedCountry(null);
          setSelected(next.cuisine);
        }}
        style={({ pressed }) => [s.adventure, pressed && s.pressed]}
      >
        <Text style={s.adventureTitle}>Explore {next.cuisine}</Text>
        <Ionicons name="arrow-forward" size={22} color={colors.accent} />
      </Pressable>
      <Modal
        visible={selected !== null}
        transparent
        animationType={reduced === false ? "slide" : "none"}
        onRequestClose={() => setSelected(null)}
      >
        <View style={s.modal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close cuisine details"
            onPress={() => setSelected(null)}
            style={StyleSheet.absoluteFill}
          />
          {selected && active && (
            <View
              accessibilityViewIsModal
              style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 20) }]}
            >
              <SheetDragHandle onDismiss={() => setSelected(null)} />
              <View style={s.heading}>
                <CatalogPhoto
                  source={catalogPhoto(cuisineCovers[selected])}
                  label={selected}
                  style={s.cover}
                />
                <View style={s.flex}>
                  <Text style={s.eyebrow}>
                    {active.discoveries ? "CUISINE EXPLORER" : "A NEW CHAPTER"}
                  </Text>
                  <Text accessibilityRole="header" style={s.detailTitle}>
                    {selected} cuisine
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close cuisine details"
                  onPress={() => setSelected(null)}
                  style={s.close}
                >
                  <Ionicons name="close" size={24} color={colors.accent} />
                </Pressable>
              </View>
              <ScrollView
                style={s.detailScroll}
                contentContainerStyle={s.detailContent}
              >
                <Text style={s.copy}>
                  {cuisineRegions[selected].join(" · ")}
                </Text>
                <View style={s.progressHeader}>
                  <Text style={s.subtitle}>Food Dex progress</Text>
                  <Text style={s.progressText}>
                    {active.collected.length} / {active.total} foods
                  </Text>
                </View>
                <View style={s.track}>
                  <View
                    style={[s.fill, { width: `${active.fraction * 100}%` }]}
                  />
                </View>
                <Text style={s.small}>
                  {active.discoveries}{" "}
                  {active.discoveries === 1 ? "discovery" : "discoveries"} ·{" "}
                  {active.collected.length} catalog matches
                </Text>
                <View style={s.stamp}>
                  <Ionicons
                    name={mastery ? "ribbon-outline" : "compass-outline"}
                    size={30}
                    color={colors.accent}
                  />
                  <View style={s.flex}>
                    <Text style={s.subtitle}>
                      {mastery
                        ? `${mastery} cuisine stamp`
                        : "Your first atlas discovery awaits"}
                    </Text>
                    <Text style={s.copy}>
                      {mastery
                        ? "Earned from your Food Dex collection. Keep tasting to upgrade it."
                        : "Collect 3 catalog dishes in this cuisine to earn Bronze."}
                    </Text>
                  </View>
                </View>
                <Text style={s.subtitle}>
                  {active.collected.length
                    ? "Collected by you"
                    : "Start with a signature dish"}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={s.foods}
                >
                  {detailDishes.map((dish) => (
                    <View key={dish.id} style={s.food}>
                      <CatalogPhoto
                        source={catalogPhoto(dish)}
                        label={dish.name}
                        style={s.foodPhoto}
                      />
                      <Text style={s.foodName}>{dish.name}</Text>
                    </View>
                  ))}
                </ScrollView>
                {onOpenDex && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelected(null);
                      onOpenDex();
                    }}
                    style={({ pressed }) => [s.button, pressed && s.pressed]}
                  >
                    <Text style={s.buttonText}>Explore dishes in Food Dex</Text>
                    <Ionicons
                      name="arrow-forward"
                      size={18}
                      color={colors.white}
                    />
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  card: {
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    gap: 6,
    overflow: "hidden",
  },
  heading: { flexDirection: "row", alignItems: "center", gap: 8 },
  flex: { flex: 1, gap: 5 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.muted,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: -0.8,
    color: colors.ink,
    marginTop: 0,
  },
  compass: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: { fontSize: 12, lineHeight: 19, color: colors.muted },
  small: { fontSize: 11, lineHeight: 17, color: colors.muted },
  mapSurface: {
    backgroundColor: "#F1F4EB",
    borderRadius: 14,
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    overflow: "hidden",
  },
  map: { width: "100%", aspectRatio: 720 / 390 },
  mapPressed: { opacity: 0.78 },
  marker: {
    position: "absolute",
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
  },
  markerPhoto: {
    width: 29,
    height: 29,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: colors.white,
  },
  markerCount: {
    position: "absolute",
    right: 1,
    bottom: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  markerCountText: { color: colors.white, fontSize: 9, fontWeight: "700" },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { width: 7, height: 7, borderRadius: 4 },
  progressHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 6,
    alignItems: "center",
  },
  subtitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  progressText: { fontSize: 11, fontWeight: "700", color: colors.accent },
  track: {
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E7EBDF",
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
  chips: { gap: 6, paddingVertical: 1 },
  chip: {
    minHeight: 34,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 10,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  unlockedChip: { backgroundColor: colors.tint },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.accent },
  adventure: {
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.tint,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  adventureTitle: { fontSize: 13, fontWeight: "700", color: colors.ink },
  pressed: { opacity: 0.65 },
  modal: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 600,
    maxHeight: "88%",
    backgroundColor: colors.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    gap: 16,
  },
  cover: { width: 58, height: 64, borderRadius: 16 },
  detailTitle: { fontSize: 22, fontWeight: "700", color: colors.ink },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  detailScroll: { flexShrink: 1 },
  detailContent: { gap: 14, paddingBottom: 4 },
  stamp: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accent,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.tint,
  },
  foods: { gap: 12 },
  food: { width: 108, gap: 7 },
  foodPhoto: { width: 108, height: 94, borderRadius: 16 },
  foodName: { fontSize: 12, fontWeight: "600", color: colors.ink },
  button: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    padding: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.white,
    flexShrink: 1,
  },
});
