import { useState } from "react";
import {
  AwardPopup,
  type Award,
} from "../../gamification/components/AwardPopup";
import {
  badgeAwards,
  discoveryAwards,
} from "../../gamification/models/discoveryAwards";
import type { BadgeId } from "../../gamification/models/gamification";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DiscoveryCard } from "./DiscoveryCard";
import { CollectionProgress } from "./CollectionProgress";
import { collectionProgress, cuisineAnchors } from "../models/discovery";
import {
  advancedCollectionQuests,
  collectionQuestProgress,
} from "../../quests/models/collectionQuests";
import type { FoodEntry } from "../models/foodDex";
import { discoveryColors as c } from "../../../theme";

export type DiscoveryMoment = {
  entry: FoodEntry;
  before: FoodEntry[];
  badges?: BadgeId[];
};
export function DiscoveryReveal({
  moment,
  gameXp = 0,
  visited = [],
  entries,
  onClose,
  onAtlas,
}: {
  moment: DiscoveryMoment;
  gameXp?: number;
  visited?: string[];
  entries: FoodEntry[];
  onClose: () => void;
  onAtlas: () => void;
}) {
  const [awards] = useState<Award[]>(() => {
    const after = entries.some((item) => item.id === moment.entry.id)
      ? entries
      : [moment.entry, ...entries];
    return [
      ...badgeAwards(moment.badges ?? [], moment.entry.id),
      ...discoveryAwards(moment.before, after, moment.entry.id, gameXp, visited),
    ];
  });
  const [awardIndex, setAwardIndex] = useState(0);
  const insets = useSafeAreaInsets();
  const { entry, before } = moment;
  const firstCuisine = !before.some((item) => item.cuisine === entry.cuisine);
  const progress = collectionProgress(entries, entry.cuisine);
  const previous = collectionProgress(before, entry.cuisine);
  return (
    <View accessibilityViewIsModal style={s.screen}>
      <AwardPopup
        award={awards[awardIndex]}
        remaining={awards.length - awardIndex - 1}
        onContinue={() => setAwardIndex((index) => index + 1)}
      />
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
        ]}
      >
        <SheetDragHandle onDismiss={onClose} />
        <View style={s.heading}>
          <Text style={s.eyebrow}>FOOD DEX</Text>
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
          <Text style={s.title}>{entry.name} collected!</Text>
        </View>
        <DiscoveryCard key={entry.id} entry={entry} entrance />
        {advancedCollectionQuests(before, entries).map((quest) => {
          const p = collectionQuestProgress(quest, entries);
          return (
            <View
              key={quest.id}
              style={s.newRegion}
              accessibilityLiveRegion="polite"
            >
              <Ionicons
                name={p.complete ? "ribbon" : "checkmark-circle-outline"}
                size={24}
                color={c.glow}
                accessible={false}
              />
              <View style={s.flex}>
                <Text style={s.progressTitle}>
                  {quest.title} · {p.count}/{quest.target}
                </Text>
                <Text style={s.copy}>
                  {p.complete
                    ? `${quest.reward} · +${quest.xp} XP`
                    : `${quest.target - p.count} left to collect`}
                </Text>
              </View>
            </View>
          );
        })}
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
