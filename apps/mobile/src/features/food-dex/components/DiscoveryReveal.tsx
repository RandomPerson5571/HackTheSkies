import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoveryCard } from "./DiscoveryCard";
import { CollectionProgress } from "./CollectionProgress";
import { collectionProgress, cuisineAnchors } from "../models/discovery";
import type { FoodEntry } from "../models/foodDex";
import { discoveryColors as c } from "../../../theme";

export type DiscoveryMoment = { entry: FoodEntry; before: FoodEntry[] };
export function DiscoveryReveal({
  moment,
  entries,
  onClose,
  onAtlas,
}: {
  moment: DiscoveryMoment;
  entries: FoodEntry[];
  onClose: () => void;
  onAtlas: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { entry, before } = moment;
  const firstCuisine = !before.some((item) => item.cuisine === entry.cuisine);
  const progress = collectionProgress(entries, entry.cuisine);
  const previous = collectionProgress(before, entry.cuisine);
  return (
    <View accessibilityViewIsModal style={s.screen}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <View style={s.heading}>
          <Text style={s.eyebrow}>A FIRST BITE. FOREVER YOURS.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close discovery reveal"
            onPress={onClose}
            style={({ pressed }) => [s.close, pressed && s.dim]}
          >
            <Ionicons
              name="close"
              size={22}
              color={c.light}
              accessible={false}
            />
          </Pressable>
        </View>
        <View accessibilityLiveRegion="polite" style={s.intro}>
          <Text style={s.title}>Discovery unlocked.</Text>
          <Text style={s.copy}>{entry.name} has joined your Food Dex.</Text>
        </View>
        <DiscoveryCard key={entry.id} entry={entry} entrance />
        <View style={s.progress}>
          <View style={s.progressHeading}>
            <Text style={s.progressTitle}>{entry.cuisine} collection</Text>
            <Text style={s.count}>
              {progress.total
                ? `${progress.collected} / ${progress.total}`
                : `${entries.filter((item) => item.cuisine === entry.cuisine).length} collected`}
            </Text>
          </View>
          <CollectionProgress
            value={progress.fraction}
            from={previous.fraction}
            color={c.glow}
            trackColor={c.line}
          />
          <Text style={s.copy}>
            {entries.length} {entries.length === 1 ? "dish" : "dishes"} in your
            story. One more reason to be curious.
          </Text>
        </View>
        {firstCuisine && cuisineAnchors[entry.cuisine] && (
          <View style={s.newRegion}>
            <Ionicons
              name="earth-outline"
              size={24}
              color={c.glow}
              accessible={false}
            />
            <View style={s.flex}>
              <Text style={s.progressTitle}>A new light on your atlas.</Text>
              <Text style={s.copy}>
                {entry.cuisine} cuisine is now illuminated.
              </Text>
            </View>
          </View>
        )}
        {cuisineAnchors[entry.cuisine] && (
          <Pressable
            accessibilityRole="button"
            onPress={onAtlas}
            style={({ pressed }) => [s.primary, pressed && s.dim]}
          >
            <Ionicons
              name="planet-outline"
              size={20}
              color={c.night}
              accessible={false}
            />
            <Text style={s.primaryText}>See it on my atlas</Text>
            <Ionicons
              name="arrow-forward"
              size={18}
              color={c.night}
              accessible={false}
            />
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          style={({ pressed }) => [s.secondary, pressed && s.dim]}
        >
          <Text style={s.secondaryText}>Keep exploring</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.night },
  content: {
    paddingHorizontal: 24,
    gap: 16,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontSize: 9,
    letterSpacing: 1.5,
    color: c.glow,
    fontWeight: "700",
    flexShrink: 1,
  },
  close: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
    borderRadius: 22,
  },
  intro: { alignItems: "center", gap: 8, marginBottom: 8 },
  title: {
    color: c.light,
    fontSize: 29,
    fontWeight: "700",
    letterSpacing: -0.9,
    textAlign: "center",
  },
  copy: { fontSize: 12, lineHeight: 20, color: c.muted },
  progress: { gap: 12 },
  progressHeading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  progressTitle: { fontSize: 13, fontWeight: "600", color: c.light },
  count: { fontSize: 12, color: c.glow, fontWeight: "600" },
  newRegion: {
    padding: 16,
    backgroundColor: c.surface,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: { flex: 1 },
  primary: {
    minHeight: 52,
    backgroundColor: c.glow,
    borderRadius: 28,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryText: {
    color: c.night,
    fontSize: 14,
    fontWeight: "700",
    flexShrink: 1,
  },
  secondary: { minHeight: 48, alignItems: "center", justifyContent: "center" },
  secondaryText: { color: c.light, fontSize: 13, fontWeight: "600" },
  dim: { opacity: 0.6 },
});
