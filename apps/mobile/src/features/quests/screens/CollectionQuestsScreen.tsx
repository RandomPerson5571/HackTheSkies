import { QuestLevelBar } from "../components/QuestLevelBar";
import { useQuests } from "../hooks/useQuests";
import { playerProgress } from "../../gamification/models/playerProgress";
import { CiboLogo } from "../../../components/CiboLogo";
import { QuestArt } from "../components/QuestArt";
import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { questColors as c } from "../../../theme";
import { CatalogPhoto } from "../../food-dex/components/CatalogPhoto";
import { DiscoveryCard } from "../../food-dex/components/DiscoveryCard";
import type { FoodEntry } from "../../food-dex/models/foodDex";
import { pathCuisines, pathDishes } from "../models/quests";
import {
  collectionQuests,
  collectionQuestProgress,
  type CollectionQuest,
} from "../models/collectionQuests";

type Props = {
  entries: FoodEntry[];
  gameXp: number;
  visited: string[];
  onOpenRestaurants: () => void;
  onBack: () => void;
  onOpenDex: () => void;
  onOpenCamera: () => void;
  onExplore: (cuisine: string) => void;
};
export function CollectionQuestsScreen({
  entries,
  gameXp,
  visited,
  onOpenRestaurants,
  onBack,
  onOpenDex,
  onOpenCamera,
  onExplore,
}: Props) {
  const insets = useSafeAreaInsets();
  const { state: quests } = useQuests();
  const levelProgress = playerProgress(gameXp, quests, entries, visited);
  const [selected, setSelected] = useState<CollectionQuest | null>(null);
  const [cuisine, setCuisine] = useState<string>("All");
  const [memory, setMemory] = useState<FoodEntry | null>(null);
  const progress = selected
    ? collectionQuestProgress(selected, entries, visited)
    : null;
  const list = collectionQuests.filter(
    (quest) => cuisine === "All" || quest.cuisine === cuisine || !quest.cuisine,
  );
  function close() {
    setSelected(null);
    setMemory(null);
  }
  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cibo Quests, back to explore"
            onPress={onBack}
            style={({ pressed }) => [s.brand, pressed && s.dim]}
          >
            <CiboLogo />
            <View style={s.brandCopy}>
              <Text style={s.eyebrow}>YOUR NEXT CHALLENGE</Text>
              <Text style={s.brandLabel}>Quests</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Food Dex"
            onPress={onOpenDex}
            style={s.icon}
          >
            <Ionicons name="albums-outline" size={24} color={c.ink} />
          </Pressable>
        </View>
        <QuestLevelBar progress={levelProgress} />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filters}
        >
          {["All", ...pathCuisines].map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: cuisine === item }}
              onPress={() => setCuisine(item)}
              style={[s.tab, cuisine === item && s.activeTab]}
            >
              <Text style={s.tabText}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {list.length === 0 && (
          <Text style={s.body}>No challenges for this cuisine yet.</Text>
        )}
        <View style={s.grid}>
          {list.map((quest) => {
            const p = collectionQuestProgress(quest, entries, visited);
            return (
              <Pressable
                key={quest.id}
                accessibilityRole="button"
                accessibilityLabel={`${quest.title}, ${p.count} of ${quest.target} collected${p.complete ? ", reward earned" : ""}`}
                onPress={() => setSelected(quest)}
                style={({ pressed }) => [s.card, pressed && s.dim]}
              >
                <View style={s.cardArt}>
                  <QuestArt metric={quest.metric} cuisine={quest.cuisine} />
                  {p.complete && (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={c.success}
                      style={s.completeMark}
                    />
                  )}
                </View>
                <Text style={s.tileTitle}>
                  {quest.title.replace("First Bite · ", "")}
                  {quest.metric === "cuisine" ? " · First Bite" : ""}
                </Text>
                <Text style={s.tileHint}>
                  {p.complete ? quest.reward : quest.hint}
                </Text>
                <View
                  accessibilityRole="progressbar"
                  accessibilityLabel={quest.title}
                  accessibilityValue={{
                    min: 0,
                    max: quest.target,
                    now: p.count,
                  }}
                  style={s.track}
                >
                  <View
                    style={[
                      s.fill,
                      { width: `${(p.count / quest.target) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={s.small}>
                  {p.count}/{quest.target} collected · {quest.xp} XP
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Modal
        visible={selected !== null}
        animationType="fade"
        transparent
        onRequestClose={close}
      >
        <View style={s.scrim}>
          <View
            accessibilityViewIsModal
            style={[
              s.sheet,
              { maxHeight: "90%", paddingBottom: insets.bottom + 24 },
            ]}
          >
            <ScrollView contentContainerStyle={s.sheetContent}>
              <View style={s.row}>
                <Text style={[s.title, s.flex]}>
                  {memory ? memory.name : selected?.title}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close quest"
                  onPress={close}
                  style={s.icon}
                >
                  <Ionicons name="close" size={24} color={c.ink} />
                </Pressable>
              </View>
              {memory ? (
                <DiscoveryCard entry={memory} onLight />
              ) : (
                selected &&
                progress && (
                  <>
                    {progress.complete && (
                      <View style={s.reward}>
                        <Ionicons name="ribbon" size={48} color={c.success} />
                        <Text style={s.cardTitle}>
                          {selected.metric === "set"
                            ? "Set complete"
                            : "Mission complete"}
                        </Text>
                        <Text style={s.body}>
                          {selected.reward} · {selected.xp} XP earned
                        </Text>
                      </View>
                    )}
                    <Text style={s.body}>
                      {selected.hint} · {progress.count}/{selected.target}
                    </Text>
                    {selected.metric === "restaurants" && (
                      <Text style={s.body}>
                        Mark a restaurant as visited from its saved card, or
                        rate it after your visit. Each place counts once.
                      </Text>
                    )}
                    {selected.metric === "home" && (
                      <Text style={s.body}>
                        Use “Home kitchen” in the Where field when collecting
                        your dish.
                      </Text>
                    )}
                    {selected.metric === "set" && selected.cuisine
                      ? pathDishes(selected.cuisine).map((dish) => {
                          const entry = progress.collected.find(
                            (item) =>
                              item.name.trim().toLocaleLowerCase() ===
                              dish.name.toLocaleLowerCase(),
                          );
                          return (
                            <Pressable
                              key={dish.id}
                              accessibilityRole="button"
                              onPress={() => {
                                if (entry) setMemory(entry);
                                else {
                                  close();
                                  onOpenCamera();
                                }
                              }}
                              style={s.foodRow}
                            >
                              <CatalogPhoto
                                source={
                                  entry?.photo
                                    ? { uri: entry.photo }
                                    : undefined
                                }
                                label={
                                  entry ? dish.name : `${dish.name}, missing`
                                }
                                style={s.thumbnail}
                              />
                              <View style={s.flex}>
                                <Text style={s.cardTitle}>{dish.name}</Text>
                                <Text style={s.small}>
                                  {entry
                                    ? new Date(
                                        entry.discoveredAt,
                                      ).toLocaleDateString()
                                    : "To collect"}
                                </Text>
                              </View>
                              <Ionicons
                                name={
                                  entry ? "checkmark-circle" : "camera-outline"
                                }
                                size={22}
                                color={c.ink}
                              />
                            </Pressable>
                          );
                        })
                      : progress.collected.map((entry) => (
                          <Pressable
                            accessibilityRole="button"
                            key={entry.id}
                            onPress={() => setMemory(entry)}
                            style={s.foodRow}
                          >
                            <CatalogPhoto
                              source={
                                entry.photo ? { uri: entry.photo } : undefined
                              }
                              label={entry.name}
                              style={s.thumbnail}
                            />
                            <View style={s.flex}>
                              <Text style={s.cardTitle}>{entry.name}</Text>
                              <Text style={s.small}>
                                {new Date(
                                  entry.discoveredAt,
                                ).toLocaleDateString()}
                              </Text>
                            </View>
                            <Ionicons
                              name="chevron-forward"
                              size={20}
                              color={c.ink}
                            />
                          </Pressable>
                        ))}
                    {!progress.complete && (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => {
                            close();
                            if (selected.metric === "restaurants")
                              onOpenRestaurants();
                            else onOpenCamera();
                          }}
                          style={s.button}
                        >
                          <Text style={s.buttonText}>
                            {selected.metric === "restaurants"
                              ? "Explore restaurants"
                              : "Collect a dish"}
                          </Text>
                        </Pressable>
                        {selected.cuisine && (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => {
                              const cuisine = selected.cuisine!;
                              close();
                              onExplore(cuisine);
                            }}
                            style={s.tab}
                          >
                            <Text style={s.tabText}>Explore nearby</Text>
                          </Pressable>
                        )}
                      </>
                    )}
                  </>
                )
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { minHeight: 48, flexDirection: "row", gap: 14, alignItems: "center" },
  brandCopy: { gap: 2 },
  eyebrow: { fontSize: 10, fontWeight: "700", letterSpacing: 1.3, color: c.muted },
  brandLabel: { fontSize: 28, lineHeight: 32, fontWeight: "700", color: c.ink, letterSpacing: -0.8 },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 12,
  },
  cardArt: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  completeMark: { position: "absolute", top: 0, right: 0 },
  tileTitle: { fontSize: 14, lineHeight: 19, fontWeight: "700", color: c.ink },
  tileHint: { fontSize: 12, lineHeight: 17, color: c.muted, flexGrow: 1 },
  filters: { gap: 4 },
  screen: { flex: 1, backgroundColor: c.paper },
  content: {
    padding: 16,
    gap: 16,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  flex: { flex: 1 },
  title: { fontSize: 26, fontWeight: "700", color: c.ink },
  icon: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { fontSize: 14, lineHeight: 21, color: c.muted },
  small: { fontSize: 12, lineHeight: 18, color: c.muted },
  button: {
    minHeight: 52,
    borderRadius: 28,
    padding: 16,
    backgroundColor: c.ink,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonText: { color: c.paper, fontSize: 15, fontWeight: "700" },
  tab: {
    minHeight: 48,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
  },
  activeTab: { backgroundColor: c.tint },
  tabText: { fontSize: 15, fontWeight: "600", color: c.ink },
  card: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    padding: 12,
    gap: 10,
    width: "48%",
    flexGrow: 0,
    backgroundColor: c.white,
  },
  cardTitle: { fontSize: 17, fontWeight: "600", color: c.ink },
  track: {
    height: 6,
    backgroundColor: c.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: c.success },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: c.scrim },
  sheet: {
    backgroundColor: c.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  sheetContent: { padding: 24, gap: 20 },
  reward: {
    padding: 24,
    gap: 12,
    alignItems: "center",
    backgroundColor: c.tint,
    borderRadius: 20,
  },
  foodRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: 72,
  },
  thumbnail: { width: 64, height: 64, borderRadius: 12 },
  dim: { opacity: 0.65 },
});
