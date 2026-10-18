import { playFeedback } from "../../../lib/sensory";
import { useMenuSound } from "../../../hooks/useMenuSound";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { CiboLogo } from "../../../components/CiboLogo";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { FoodEntry } from "../../food-dex/models/foodDex";
import type { Profile } from "../../profile/models/profile";
import type { Place } from "../../restaurants/data/places";
import { CatalogPhoto } from "../../food-dex/components/CatalogPhoto";
import { catalogPhoto } from "../../food-dex/services/catalogPhotos";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";
import { useQuests } from "../hooks/useQuests";
import { challenges } from "../data/challenges";
import {
  bonusCount,
  hasDish,
  bonusExpired,
  bonusTargets,
  chapters,
  claimBonus,
  completeQuest,
  pathCuisines,
  pathDishes,
  pathProgress,
  personalizedId,
  questsFor,
  questStatus,
  type Quest,
  type QuestType,
  type PathCuisine,
} from "../models/quests";
import { generateQuest } from "../services/personalizedQuest";
import { QuestButton, QuestDialog } from "./QuestDialog";
import { questColors as c } from "../../../theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const questIcons: Record<QuestType, IconName> = {
  knowledge: "school-outline",
  discovery: "restaurant-outline",
  cultural: "book-outline",
  exploration: "compass-outline",
  mystery: "help",
  bonus: "gift-outline",
  boss: "trophy-outline",
};
const cuisineLabels: Record<PathCuisine, string> = {
  Japanese: "A TASTE OF JAPAN",
  Italian: "A TASTE OF ITALY",
  Korean: "A TASTE OF KOREA",
  Chinese: "A TASTE OF CHINA",
  French: "A TASTE OF FRANCE",
  Vietnamese: "A TASTE OF VIETNAM",
  "South Asian": "A TASTE OF SOUTH ASIA",
};

function Meter({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: total, now: value }}
      style={s.meter}
    >
      <View
        style={[
          s.meterFill,
          { width: `${Math.min(100, (value / total) * 100)}%` },
        ]}
      />
    </View>
  );
}
function Tab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        s.tab,
        active && s.activeTab,
        pressed && s.pressed,
      ]}
    >
      <Text style={[s.tabText, active && s.activeTabText]}>{label}</Text>
    </Pressable>
  );
}
function PathNode({
  quest,
  status,
  onPress,
}: {
  quest: Quest;
  status: "completed" | "current" | "locked";
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const [pulse] = useState(() => new Animated.Value(1));
  useEffect(() => {
    if (status !== "current" || reduced !== false) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.12,
          duration: 1100,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
      pulse.setValue(1);
    };
  }, [status, reduced, pulse]);
  return (
    <View style={s.nodeGroup}>
      {status === "current" && (
        <Animated.View
          pointerEvents="none"
          style={[s.nodeHalo, { transform: [{ scale: pulse }] }]}
        />
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${quest.title}. ${status === "locked" ? "Locked, preview available" : status}. ${quest.xp} XP`}
        onPress={onPress}
        style={({ pressed }) => [
          s.node,
          quest.type === "boss" && s.bossNode,
          status === "current" && s.currentNode,
          status === "completed" && s.completedNode,
          status === "locked" && s.lockedNode,
          pressed && s.pressed,
        ]}
      >
        <Ionicons
          name={
            status === "completed"
              ? "checkmark"
              : status === "locked"
                ? "lock-closed"
                : questIcons[quest.type]
          }
          size={30}
          color={status === "current" ? c.paper : c.ink}
          accessible={false}
        />
      </Pressable>
      <Text style={[s.nodeTitle, status === "locked" && { color: c.muted }]}>
        {quest.title}
      </Text>
      <Text style={s.nodeType}>
        {status === "completed"
          ? "COMPLETED"
          : status === "current"
            ? "YOUR NEXT BITE"
            : quest.type.toUpperCase()}
      </Text>
    </View>
  );
}

export function QuestsScreen({
  profile,
  entries,
  places,
  onBack,
  onOpenDex,
  onOpenCamera,
  onExplore,
}: {
  profile: Profile;
  entries: FoodEntry[];
  places: Place[];
  onBack: () => void;
  onOpenDex: () => void;
  onOpenCamera: () => void;
  onExplore: (cuisine: string) => void;
}) {
  const { state, ready, error, update, retry } = useQuests();
  const [tab, setTab] = useState<"journey" | "bonus" | "passport">("journey");
  const [selected, setSelected] = useState<Quest | null>(null);
  const [bonusId, setBonusId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [budget, setBudget] = useState<"home" | "flexible">("home");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [showPersonal, setShowPersonal] = useState(false);
  useMenuSound(bonusId !== null);
  useMenuSound(showPersonal);

  const controller = useRef<AbortController | null>(null);
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const cuisine = state.selectedCuisine;
  const path = questsFor(cuisine);
  const progress = pathProgress(state, cuisine);
  const next = path.find((quest) => questStatus(state, quest) === "current");
  const personalized = state.personalized[cuisine];
  const totalXp = pathCuisines.reduce(
    (sum, item) => sum + pathProgress(state, item).xp,
    state.bonusXp,
  );
  const stamps = pathCuisines.reduce(
    (sum, item) => sum + pathProgress(state, item).stamps,
    0,
  );
  const bonus = challenges.find((item) => item.id === bonusId);
  const run = bonusId ? state.bonus[bonusId] : undefined;
  const expired = !!(bonusId && run && bonusExpired(bonusId, run));
  useEffect(() => () => controller.current?.abort(), []);
  function openPersonalized() {
    if (!personalized) return;
    const dish = pathDishes(cuisine).find(
      (item) => item.id === personalized.dishId,
    )!;
    setSelected({
      id: personalizedId(cuisine),
      cuisine,
      chapter: 0,
      type: personalized.template === "learn" ? "knowledge" : "discovery",
      title: `Your next flavour: ${dish.name}`,
      xp: 60,
      dishId: dish.id,
    });
  }
  async function personalize() {
    const request = new AbortController();
    controller.current?.abort();
    controller.current = request;
    setGenerating(true);
    setAiError("");
    try {
      const result = await generateQuest(
        {
          cuisine,
          diet: profile.diet,
          neighborhood: profile.neighborhood,
          budget,
          collectedIds: pathDishes(cuisine)
            .filter((dish) => hasDish(entries, dish.id))
            .map((dish) => dish.id),
        },
        request.signal,
      );
      if (!request.signal.aborted)
        update((previous) => ({
          ...previous,
          personalized: { ...previous.personalized, [cuisine]: result },
        }));
    } catch (cause) {
      if (!request.signal.aborted)
        setAiError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t create a quest. Try again.",
        );
    } finally {
      if (!request.signal.aborted) setGenerating(false);
    }
  }
  const personalPanel = (
    <View style={[s.panel, s.personalPanel]}>
      <View style={s.row}>
        <Ionicons name="sparkles-outline" size={24} color={c.ink} />
        <Text style={s.panelTitle}>A quest, just for you</Text>
      </View>
      <Text style={s.copy}>
        Let AI pick your next catalog dish using your Food Dex,{" "}
        {profile.diet === "No preference"
          ? "food preferences"
          : `${profile.diet.toLowerCase()} diet`}
        , and {profile.neighborhood || "Toronto"} neighbourhood.
      </Text>
      {personalized ? (
        <>
          <Text style={s.cardTitle}>
            {
              pathDishes(cuisine).find(
                (dish) => dish.id === personalized.dishId,
              )!.name
            }
          </Text>
          <Text style={s.copy}>{personalized.reason}</Text>
          {personalized.restaurantId && (
            <Text style={s.small}>
              Restaurant to explore:{" "}
              {places.find((place) => place.id === personalized.restaurantId)
                ?.name ?? "See the map"}
              . Confirm its current menu and ingredients.
            </Text>
          )}
          <QuestButton
            title={
              state.completed.includes(personalizedId(cuisine))
                ? "Quest complete · View card"
                : "Play my quest · 60 XP"
            }
            onPress={openPersonalized}
          />
        </>
      ) : (
        <>
          <View style={s.budgetRow}>
            <Tab
              label="At home"
              active={budget === "home"}
              onPress={() => setBudget("home")}
            />
            <Tab
              label="Open to exploring"
              active={budget === "flexible"}
              onPress={() => setBudget("flexible")}
            />
          </View>
          <QuestButton
            title={
              generating ? "Finding your next flavour…" : "Create my quest · AI"
            }
            onPress={() => void personalize()}
            disabled={generating}
          />
        </>
      )}
      {aiError ? (
        <Text accessibilityLiveRegion="polite" style={s.errorText}>
          {aiError}
        </Text>
      ) : null}
      <Text style={s.small}>
        Always an at-home option. Check ingredients with the cook for dietary
        needs.
      </Text>
    </View>
  );
  const passport = (
    <View style={s.panel}>
      <View style={s.row}>
        <Ionicons name="earth-outline" size={24} color={c.ink} />
        <Text style={s.panelTitle}>Your Cibo Passport</Text>
      </View>
      <Text style={s.copy}>Small discoveries. A world of flavour.</Text>
      <View style={s.passportStats}>
        <View>
          <Text style={s.statNumber}>
            {stamps}
            <Text style={s.statSmall}>
              / {pathCuisines.length * chapters.length}
            </Text>
          </Text>
          <Text style={s.small}>chapter stamps</Text>
        </View>
        <View>
          <Text style={s.statNumber}>{totalXp}</Text>
          <Text style={s.small}>total quest XP</Text>
        </View>
      </View>
      {pathCuisines.map((item) => {
        const p = pathProgress(state, item);
        return (
          <View key={item} style={s.passportCuisine}>
            <View style={s.rowBetween}>
              <Text style={s.cardTitle}>{item}</Text>
              <Text style={s.small}>
                {p.stamps === 4 ? "Cuisine Master" : `${p.stamps} / 4 stamps`}
              </Text>
            </View>
            <View style={s.stampRow}>
              {chapters.map((chapter, index) => {
                const unlocked = state.completed.includes(
                  questsFor(item)[index * 5 + 4]!.id,
                );
                return (
                  <View
                    key={chapter.name}
                    accessible
                    accessibilityLabel={`${item}, ${chapter.name}, ${unlocked ? "earned" : "locked"}`}
                    style={[s.stamp, unlocked && s.earnedStamp]}
                  >
                    <Ionicons
                      name={unlocked ? "ribbon" : "lock-closed-outline"}
                      size={23}
                      color={c.ink}
                      accessible={false}
                    />
                    <Text style={s.stampText}>{chapter.rank}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
      <Text style={s.small}>
        Progress is saved on this device. Switching cuisines keeps every stamp
        and XP point.
      </Text>
    </View>
  );

  if (!ready)
    return (
      <View style={s.loading}>
        <ActivityIndicator color={c.ink} />
        <Text style={s.copy}>Opening your adventure…</Text>
      </View>
    );
  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 128 },
        ]}
      >
        <View style={s.header}>
          <View style={s.row}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Back to explore"
              onPress={onBack}
              style={({ pressed }) => [s.back, pressed && s.pressed]}
            >
              <Ionicons name="arrow-back" size={23} color={c.ink} />
            </Pressable>
            <View style={s.brandLockup}>
              <CiboLogo />
              <Text style={s.brand}>Quests</Text>
            </View>
          </View>
          <View style={s.xpPill}>
            <Ionicons name="flash" size={16} color={c.ink} />
            <Text style={s.xpPillText}>{totalXp} XP</Text>
          </View>
        </View>
        <View style={s.intro}>
          <Text style={s.eyebrow}>FOLLOW YOUR APPETITE</Text>
          <Text accessibilityRole="header" style={s.heading}>
            A world of flavour.{"\n"}One little quest at a time.
          </Text>
          <Text style={s.copy}>
            Learn a little. Discover a dish. Find your next favourite.
          </Text>
        </View>
        {error ? (
          <View accessibilityLiveRegion="polite" style={s.error}>
            <Text style={s.copy}>{error}</Text>
            <QuestButton title="Retry saving" onPress={retry} secondary />
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.cuisines}
        >
          {pathCuisines.map((item) => {
            const p = pathProgress(state, item);
            return (
              <Pressable
                key={item}
                accessibilityRole="button"
                accessibilityState={{ selected: cuisine === item }}
                accessibilityLabel={`${item}, Level ${p.level}, ${p.count} of ${p.total} quests`}
                onPress={() => {
                  controller.current?.abort();
                  setGenerating(false);
                  setAiError("");
                  update((previous) => ({
                    ...previous,
                    selectedCuisine: item,
                  }));
                }}
                style={({ pressed }) => [
                  s.cuisine,
                  cuisine === item && s.selectedCuisine,
                  pressed && s.pressed,
                ]}
              >
                <CatalogPhoto
                  source={catalogPhoto(pathDishes(item)[0]!)}
                  label={item}
                  style={s.cuisinePhoto}
                />
                <View style={s.cuisineCopy}>
                  <Text style={s.cardTitle}>{item}</Text>
                  <Text style={s.small}>
                    Level {p.level} · {Math.round((p.count / p.total) * 100)}%
                  </Text>
                  <Meter
                    value={p.count}
                    total={p.total}
                    label={`${item} quest completion`}
                  />
                </View>
                {cuisine === item && (
                  <Ionicons name="checkmark-circle" size={22} color={c.ink} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={s.tabs}>
          <Tab
            label="The journey"
            active={tab === "journey"}
            onPress={() => setTab("journey")}
          />
          <Tab
            label="Bonus quests"
            active={tab === "bonus"}
            onPress={() => setTab("bonus")}
          />
          <Tab
            label="Passport"
            active={tab === "passport"}
            onPress={() => setTab("passport")}
          />
        </View>
        {tab === "journey" ? (
          <View style={[s.columns, wide && s.wideColumns]}>
            <View style={s.mainColumn}>
              <View style={s.hero}>
                <View style={s.heroCopy}>
                  <Text style={s.heroEyebrow}>{cuisineLabels[cuisine]}</Text>
                  <Text style={s.heroTitle}>
                    {cuisine}
                    {"\n"}Adventure
                  </Text>
                  <Text style={s.heroSubtitle}>
                    Level {progress.level} ·{" "}
                    {progress.stamps === 4
                      ? "Cuisine Master"
                      : chapters[Math.min(progress.stamps, 3)]!.rank}
                  </Text>
                  <Meter
                    value={progress.levelXp}
                    total={200}
                    label="XP to next level"
                  />
                  <Text style={s.heroSmall}>
                    {progress.levelXp} / 200 XP to next level
                  </Text>
                </View>
                <View style={s.heroArt}>
                  <MaterialCommunityIcons
                    name="bowl-mix-outline"
                    size={86}
                    color={c.lime}
                    accessible={false}
                  />
                  <View style={s.heroSpark}>
                    <Ionicons name="sparkles" size={23} color={c.navy} />
                  </View>
                </View>
              </View>
              <View style={s.continueCard}>
                <View style={s.continueCopy}>
                  <Text style={s.eyebrow}>
                    {next
                      ? "READY FOR YOUR NEXT BITE?"
                      : "ALL FOUR CHAPTERS COMPLETE"}
                  </Text>
                  <Text style={s.cardTitle}>
                    {next?.title ?? `${cuisine} Cuisine Master`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    next ? `Continue: ${next.title}` : "View passport"
                  }
                  onPress={() =>
                    next ? setSelected(next) : setTab("passport")
                  }
                  style={({ pressed }) => [
                    s.continueButton,
                    pressed && s.pressed,
                  ]}
                >
                  <Ionicons
                    name={next ? "arrow-forward" : "ribbon-outline"}
                    size={24}
                    color={c.paper}
                  />
                </Pressable>
              </View>
              {!wide && (
                <View style={s.panel}>
                  <View style={s.rowBetween}>
                    <Text style={s.panelTitle}>A quest, just for you</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPersonal
                          ? "Hide personalized quest"
                          : "Show personalized quest"
                      }
                      accessibilityState={{ expanded: showPersonal }}
                      onPress={() => setShowPersonal((value) => !value)}
                      style={s.back}
                    >
                      <Ionicons
                        name={showPersonal ? "chevron-up" : "sparkles-outline"}
                        size={24}
                        color={c.ink}
                      />
                    </Pressable>
                  </View>
                  {showPersonal ? (
                    personalPanel
                  ) : (
                    <Text style={s.copy}>
                      An AI-picked adventure inspired by your Food Dex. Tap the
                      sparkles to begin.
                    </Text>
                  )}
                </View>
              )}
              {chapters.map((chapter, chapterIndex) => (
                <View key={chapter.name} style={s.chapter}>
                  <View style={s.chapterHeader}>
                    <View style={s.chapterNumber}>
                      <Text style={s.chapterNumberText}>
                        {String(chapterIndex + 1).padStart(2, "0")}
                      </Text>
                    </View>
                    <View style={s.chapterCopy}>
                      <Text style={s.eyebrow}>
                        CHAPTER {chapterIndex + 1} ·{" "}
                        {chapter.rank.toUpperCase()}
                      </Text>
                      <Text accessibilityRole="header" style={s.chapterTitle}>
                        {chapter.name}
                      </Text>
                      <Text style={s.small}>{chapter.subtitle}</Text>
                    </View>
                    <Text style={s.chapterCount}>
                      {
                        path
                          .slice(chapterIndex * 5, chapterIndex * 5 + 5)
                          .filter((quest) => state.completed.includes(quest.id))
                          .length
                      }
                      /5
                    </Text>
                  </View>
                  <View style={s.path}>
                    {path
                      .slice(chapterIndex * 5, chapterIndex * 5 + 5)
                      .map((quest, index) => {
                        const offsets = [-48, 24, 64, 0, -48];
                        const offset = offsets[index]!;
                        return (
                          <View key={quest.id} style={s.pathRow}>
                            {index < 4 && (
                              <View
                                pointerEvents="none"
                                style={[
                                  s.connector,
                                  {
                                    marginLeft:
                                      (offset + offsets[index + 1]!) / 2,
                                    transform: [
                                      {
                                        rotate: `${(-Math.atan((offsets[index + 1]! - offset) / 142) * 180) / Math.PI}deg`,
                                      },
                                    ],
                                  },
                                ]}
                              />
                            )}
                            <View
                              style={{ transform: [{ translateX: offset }] }}
                            >
                              <PathNode
                                quest={quest}
                                status={questStatus(state, quest)}
                                onPress={() => setSelected(quest)}
                              />
                            </View>
                          </View>
                        );
                      })}
                  </View>
                  <View style={s.chapterReward}>
                    <Ionicons name="ribbon-outline" size={20} color={c.ink} />
                    <Text style={s.small}>
                      {state.completed.includes(path[chapterIndex * 5 + 4]!.id)
                        ? "STAMP EARNED"
                        : "CHAPTER REWARD"}{" "}
                      · {pathDishes(cuisine)[chapterIndex]!.name} learning card
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <View style={[s.sideColumn, wide && { width: 320 }]}>
              {wide && personalPanel}
              {passport}
              <View style={[s.panel, { backgroundColor: c.peach }]}>
                <Ionicons name="heart-outline" size={26} color={c.ink} />
                <Text style={s.panelTitle}>Curiosity counts.</Text>
                <Text style={s.copy}>
                  No restaurant budget? No problem. Every discovery has an
                  equally rewarding way to learn at home.
                </Text>
              </View>
            </View>
          </View>
        ) : tab === "passport" ? (
          <View style={s.passportPage}>
            {passport}
            <Text style={s.chapterTitle}>Your learning cards</Text>
            <Text style={s.copy}>
              Cards earned by completing quests. Your real food discoveries are
              in Food Dex.
            </Text>
            <View style={s.cardGrid}>
              {pathCuisines.flatMap((item) =>
                pathDishes(item).map((dish, chapter) => {
                  const learned =
                    questsFor(item).some(
                      (quest) =>
                        quest.chapter === chapter &&
                        state.completed.includes(quest.id),
                    ) ||
                    (state.personalized[item]?.dishId === dish.id &&
                      state.completed.includes(personalizedId(item)));
                  return (
                    <View
                      key={dish.id}
                      style={[
                        s.learningCard,
                        !learned && { backgroundColor: c.locked },
                      ]}
                    >
                      {learned ? (
                        <CatalogPhoto
                          source={catalogPhoto(dish)}
                          label={dish.name}
                          style={s.learningPhoto}
                        />
                      ) : (
                        <View style={[s.learningPhoto, s.cardLock]}>
                          <Ionicons
                            name="lock-closed-outline"
                            size={30}
                            color={c.muted}
                          />
                        </View>
                      )}
                      <View style={s.learningCopy}>
                        <Text style={s.eyebrow}>{item.toUpperCase()}</Text>
                        <Text style={s.cardTitle}>{dish.name}</Text>
                        <Text style={s.small}>
                          {learned
                            ? "Learning card earned"
                            : "Complete a quest to unlock"}
                        </Text>
                      </View>
                    </View>
                  );
                }),
              )}
            </View>
            <QuestButton title="Open Food Dex" secondary onPress={onOpenDex} />
          </View>
        ) : (
          <>
            <View style={s.bonusIntro}>
              <Text accessibilityRole="header" style={s.chapterTitle}>
                Choose your challenge
              </Text>
              <Text style={s.copy}>
                Check in at qualifying spots before time runs out to earn XP.
              </Text>
            </View>
            <View style={s.cardGrid}>
              {challenges.map((challenge) => {
                const activeRun = state.bonus[challenge.id];
                const count = bonusCount(challenge.id, activeRun);
                const isExpired =
                  activeRun && bonusExpired(challenge.id, activeRun);
                return (
                  <Pressable
                    key={challenge.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${challenge.title}, ${challenge.points} XP, ${activeRun?.claimed ? "completed" : activeRun ? `${count} of ${bonusTargets[challenge.id]}` : "join quest"}`}
                    onPress={() => {
                      setBonusId(challenge.id);
                      setSearch("");
                    }}
                    style={({ pressed }) => [s.bonusCard, pressed && s.pressed]}
                  >
                    <View style={s.rowBetween}>
                      <View style={s.bonusIcon}>
                        <Ionicons
                          name={challenge.icon}
                          size={26}
                          color={c.ink}
                        />
                      </View>
                      <Text style={s.eyebrow}>{challenge.points} XP</Text>
                    </View>
                    <Text style={s.eyebrow}>{challenge.cadence}</Text>
                    <Text style={s.cardTitle}>{challenge.title}</Text>
                    <Text style={s.copy}>{challenge.summary}</Text>
                    {activeRun && !isExpired && (
                      <Meter
                        value={Math.min(count, bonusTargets[challenge.id]!)}
                        total={bonusTargets[challenge.id]!}
                        label={`${challenge.title} progress`}
                      />
                    )}
                    <Text style={s.bonusLink}>
                      {isExpired
                        ? "Start again"
                        : activeRun?.claimed
                          ? "Completed ✓"
                          : activeRun
                            ? `${count} / ${bonusTargets[challenge.id]} · Log a visit`
                            : "Join adventure →"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
      {selected && (
        <QuestDialog
          key={selected.id}
          quest={selected}
          status={
            selected.id.startsWith("personalized-")
              ? state.completed.includes(selected.id)
                ? "completed"
                : "current"
              : questStatus(state, selected)
          }
          entries={entries}
          personalized={selected.id.startsWith("personalized-")}
          onClose={() => setSelected(null)}
          onComplete={() =>
            update((previous) =>
              selected.id.startsWith("personalized-")
                ? previous.completed.includes(selected.id) ||
                  !previous.personalized[selected.cuisine]
                  ? previous
                  : {
                      ...previous,
                      completed: [...previous.completed, selected.id],
                    }
                : completeQuest(previous, selected),
            )
          }
          onCamera={onOpenCamera}
          onDex={onOpenDex}
          onExplore={() => onExplore(selected.cuisine)}
        />
      )}
      {bonus && (
        <Modal
          visible
          transparent
          animationType={reduced === false ? "fade" : "none"}
          onRequestClose={() => setBonusId(null)}
        >
          <View
            style={[
              s.scrim,
              {
                paddingTop: insets.top + 16,
                paddingBottom: insets.bottom + 16,
              },
            ]}
          >
            <View accessibilityViewIsModal style={s.bonusDialog}>
              <SheetDragHandle onDismiss={() => setBonusId(null)} />
              <ScrollView contentContainerStyle={s.bonusDialogContent}>
                <View style={s.rowBetween}>
                  <Text style={s.eyebrow}>
                    {bonus.cadence} · {bonus.points} XP
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close bonus quest"
                    onPress={() => setBonusId(null)}
                    style={s.back}
                  >
                    <Ionicons name="close" size={24} color={c.ink} />
                  </Pressable>
                </View>
                <Text style={s.chapterTitle}>{bonus.title}</Text>
                <Text style={s.copy}>{bonus.details}</Text>
                {!run || expired ? (
                  <>
                    <Text style={s.small}>
                      {expired
                        ? "That adventure ended. Start a fresh one whenever you’re ready."
                        : "Check-ins are self-reported. Only visits you log after joining count."}
                    </Text>
                    <QuestButton
                      title={
                        expired
                          ? "Start a new adventure"
                          : "Join this adventure"
                      }
                      onPress={() => {
                        void playFeedback("interfaceClick");
                        update((previous) => ({
                          ...previous,
                          bonus: {
                            ...previous.bonus,
                            [bonus.id]: {
                              startedAt: new Date().toISOString(),
                              visits: [],
                              claimed: false,
                            },
                          },
                        }));
                      }}
                    />
                  </>
                ) : run.claimed ? (
                  <View style={s.claimed}>
                    <Ionicons
                      name="checkmark-circle"
                      size={40}
                      color={c.success}
                    />
                    <Text style={s.panelTitle}>Adventure complete!</Text>
                    <Text style={s.copy}>
                      {bonus.points} XP added to your passport. You can start
                      again after this adventure’s period ends.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={s.cardTitle}>
                      {bonusCount(bonus.id, run)} / {bonusTargets[bonus.id]}{" "}
                      {bonus.metric === "cuisines"
                        ? "cuisines"
                        : bonus.metric === "neighbourhoods"
                          ? "neighbourhoods"
                          : bonus.metric === "categories"
                            ? "categories"
                            : bonus.category
                              ? `${bonus.category} spots`
                              : "spots"}
                    </Text>
                    <Text style={s.small}>
                      Ends{" "}
                      {new Date(
                        Date.parse(run.startedAt) +
                          (bonus.cadence === "WEEKLY" ? 7 : 30) * 86400000,
                      ).toLocaleDateString()}
                    </Text>
                    <Meter
                      value={Math.min(
                        bonusCount(bonus.id, run),
                        bonusTargets[bonus.id]!,
                      )}
                      total={bonusTargets[bonus.id]!}
                      label="Bonus quest completion"
                    />
                    {bonusCount(bonus.id, run) >= bonusTargets[bonus.id]! ? (
                      <QuestButton
                        title={`Claim ${bonus.points} XP`}
                        onPress={() => {
                          update((previous) => claimBonus(previous, bonus.id));
                          void playFeedback("bell");
                        }}
                      />
                    ) : (
                      <>
                        <Text style={s.small}>
                          Choose a spot that fits. Each spot counts once.
                        </Text>
                        <TextInput
                          accessibilityLabel="Search restaurants for a qualifying visit"
                          value={search}
                          onChangeText={setSearch}
                          placeholder="Search restaurant or neighbourhood"
                          placeholderTextColor={c.muted}
                          style={s.search}
                        />
                        {places
                          .filter(
                            (place) =>
                              `${place.name} ${place.neighborhood}`
                                .toLowerCase()
                                .includes(search.toLowerCase()) &&
                              (!bonus.category ||
                                place.category === bonus.category) &&
                              (bonus.metric !== "categories" ||
                                !run.visits.some(
                                  (visit) => visit.category === place.category,
                                )) &&
                              (bonus.metric !== "cuisines" ||
                                (!!place.cuisine &&
                                  !run.visits.some(
                                    (visit) => visit.cuisine === place.cuisine,
                                  ))) &&
                              (bonus.metric !== "neighbourhoods" ||
                                !run.visits.some(
                                  (visit) =>
                                    visit.neighborhood === place.neighborhood,
                                )) &&
                              !run.visits.some(
                                (visit) => visit.id === place.id,
                              ),
                          )
                          .slice(0, 5)
                          .map((place) => (
                            <Pressable
                              key={place.id}
                              accessibilityRole="button"
                              accessibilityLabel={`Log qualifying visit to ${place.name}`}
                              onPress={() =>
                                update((previous) => {
                                  const current = previous.bonus[bonus.id];
                                  if (
                                    !current ||
                                    current.claimed ||
                                    bonusExpired(bonus.id, current) ||
                                    current.visits.some(
                                      (visit) => visit.id === place.id,
                                    )
                                  )
                                    return previous;
                                  return {
                                    ...previous,
                                    bonus: {
                                      ...previous.bonus,
                                      [bonus.id]: {
                                        ...current,
                                        visits: [
                                          ...current.visits,
                                          {
                                            id: place.id,
                                            cuisine: place.cuisine ?? "",
                                            neighborhood: place.neighborhood,
                                            category: place.category,
                                          },
                                        ],
                                      },
                                    },
                                  };
                                })
                              }
                              style={({ pressed }) => [
                                s.placeOption,
                                pressed && s.pressed,
                              ]}
                            >
                              <View style={s.flex}>
                                <Text style={s.cardTitle}>{place.name}</Text>
                                <Text style={s.small}>
                                  {place.neighborhood} ·{" "}
                                  {place.cuisine || place.category}
                                </Text>
                              </View>
                              <Ionicons
                                name="add-circle-outline"
                                size={24}
                                color={c.ink}
                              />
                            </Pressable>
                          ))}
                      </>
                    )}
                    <QuestButton
                      title="Leave this adventure"
                      secondary
                      onPress={() =>
                        update((previous) => {
                          if (previous.bonus[bonus.id]?.claimed)
                            return previous;
                          const remaining = { ...previous.bonus };
                          delete remaining[bonus.id];
                          return { ...previous, bonus: remaining };
                        })
                      }
                    />
                    {run.visits.length > 0 && (
                      <>
                        <Text style={s.eyebrow}>
                          YOUR CHECK-INS · TAP TO REMOVE
                        </Text>
                        {run.visits.map((visit) => (
                          <Pressable
                            key={visit.id}
                            accessibilityRole="button"
                            accessibilityLabel={`Remove visit to ${places.find((place) => place.id === visit.id)?.name ?? visit.id}`}
                            onPress={() =>
                              update((previous) => {
                                const current = previous.bonus[bonus.id];
                                if (!current || current.claimed)
                                  return previous;
                                return {
                                  ...previous,
                                  bonus: {
                                    ...previous.bonus,
                                    [bonus.id]: {
                                      ...current,
                                      visits: current.visits.filter(
                                        (item) => item.id !== visit.id,
                                      ),
                                    },
                                  },
                                };
                              })
                            }
                            style={s.placeOption}
                          >
                            <Text style={[s.small, s.flex]}>
                              {places.find((place) => place.id === visit.id)
                                ?.name ?? visit.id}
                            </Text>
                            <Ionicons
                              name="remove-circle-outline"
                              size={22}
                              color={c.ink}
                            />
                          </Pressable>
                        ))}
                      </>
                    )}
                  </>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: c.paper },
  content: {
    width: "100%",
    maxWidth: 1160,
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 28,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    backgroundColor: c.paper,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  flex: { flex: 1 },
  back: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.border,
  },
  brandLockup: { alignItems: "center", gap: 6 },
  brand: {
    color: c.muted,
    fontSize: 13,
    fontWeight: "400",
    letterSpacing: 0.5,
  },
  xpPill: {
    backgroundColor: c.lime,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  xpPillText: { color: c.ink, fontWeight: "800", fontSize: 13 },
  intro: { gap: 12, marginTop: 12 },
  eyebrow: {
    color: c.muted,
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  heading: {
    color: c.navy,
    fontSize: 36,
    fontWeight: "800",
    lineHeight: 43,
    letterSpacing: -1.5,
  },
  copy: { color: c.muted, fontSize: 14, lineHeight: 22 },
  small: { color: c.muted, fontSize: 12, lineHeight: 19 },
  cuisines: { gap: 12, paddingVertical: 4 },
  cuisine: {
    width: 268,
    padding: 14,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: c.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  selectedCuisine: { borderColor: c.ink, backgroundColor: c.lime },
  cuisinePhoto: { width: 56, height: 56, borderRadius: 17 },
  cuisineCopy: { flex: 1, gap: 5 },
  cardTitle: { color: c.navy, fontWeight: "800", fontSize: 16, lineHeight: 22 },
  meter: {
    height: 6,
    width: "100%",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: c.border,
  },
  meterFill: { height: "100%", backgroundColor: c.ink, borderRadius: 6 },
  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: c.border,
    gap: 8,
  },
  tab: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 3,
    borderColor: "transparent",
  },
  activeTab: { borderBottomColor: c.ink },
  tabText: {
    color: c.muted,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  activeTabText: { color: c.navy, fontWeight: "800" },
  columns: { gap: 28 },
  wideColumns: { flexDirection: "row", alignItems: "flex-start" },
  mainColumn: { flex: 1, minWidth: 0, gap: 24 },
  sideColumn: { gap: 20 },
  hero: {
    backgroundColor: c.navy,
    borderRadius: 28,
    padding: 24,
    flexDirection: "row",
    gap: 12,
    overflow: "hidden",
    alignItems: "center",
  },
  heroCopy: { flex: 1, gap: 12 },
  heroEyebrow: {
    color: c.lime,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
  },
  heroTitle: {
    color: c.paper,
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "800",
    letterSpacing: -1,
  },
  heroSubtitle: { color: c.lime, fontSize: 13, fontWeight: "600" },
  heroSmall: { color: c.paper, fontSize: 11 },
  heroArt: {
    width: 94,
    height: 115,
    justifyContent: "center",
    alignItems: "center",
  },
  heroSpark: {
    position: "absolute",
    right: 0,
    top: 0,
    backgroundColor: c.lime,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    transform: [{ rotate: "12deg" }],
  },
  continueCard: {
    backgroundColor: c.lime,
    padding: 18,
    borderRadius: 22,
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  continueCopy: { flex: 1, gap: 7 },
  continueButton: {
    backgroundColor: c.navy,
    width: 50,
    height: 50,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  chapter: { gap: 22, paddingTop: 12 },
  chapterHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  chapterNumber: {
    backgroundColor: c.lavender,
    width: 42,
    height: 48,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  chapterNumberText: { color: c.ink, fontSize: 18, fontWeight: "800" },
  chapterCopy: { flex: 1, gap: 5 },
  chapterTitle: {
    color: c.navy,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  chapterCount: { color: c.ink, fontSize: 13, fontWeight: "800" },
  path: { paddingTop: 8, alignItems: "center" },
  pathRow: { height: 156, width: "100%", alignItems: "center" },
  connector: {
    position: "absolute",
    top: 42,
    height: 170,
    width: 3,
    borderLeftWidth: 3,
    borderStyle: "dashed",
    borderColor: c.border,
    left: "50%",
  },
  nodeGroup: { width: 180, alignItems: "center", gap: 8 },
  node: {
    width: 76,
    height: 72,
    borderRadius: 30,
    borderBottomWidth: 6,
    borderBottomColor: c.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.lavender,
  },
  currentNode: { backgroundColor: c.navy, borderBottomColor: c.ink },
  completedNode: { backgroundColor: c.lime, borderBottomColor: "#CDDD8D" },
  lockedNode: { backgroundColor: c.locked, borderBottomColor: c.border },
  bossNode: { borderRadius: 23, backgroundColor: c.peach },
  nodeHalo: {
    position: "absolute",
    top: -8,
    width: 92,
    height: 88,
    borderWidth: 2,
    borderColor: c.ink,
    borderRadius: 38,
  },
  nodeTitle: {
    maxWidth: 180,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    color: c.ink,
    lineHeight: 18,
  },
  nodeType: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1,
    color: c.muted,
  },
  chapterReward: {
    backgroundColor: c.lavender,
    borderRadius: 15,
    padding: 15,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  panel: {
    borderWidth: 1,
    borderColor: c.border,
    padding: 22,
    borderRadius: 24,
    gap: 16,
  },
  panelTitle: { color: c.navy, fontSize: 17, fontWeight: "800", flexShrink: 1 },
  personalPanel: { backgroundColor: c.lavender, borderColor: c.lavender },
  budgetRow: { flexDirection: "row" },
  passportStats: { flexDirection: "row", gap: 28, paddingVertical: 8 },
  statNumber: { fontSize: 30, fontWeight: "800", color: c.navy },
  statSmall: { color: c.muted, fontSize: 16 },
  passportCuisine: { gap: 12, paddingTop: 10 },
  stampRow: { flexDirection: "row", gap: 6 },
  stamp: {
    flex: 1,
    gap: 6,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderStyle: "dashed",
    alignItems: "center",
    borderRadius: 13,
  },
  earnedStamp: {
    backgroundColor: c.lime,
    borderStyle: "solid",
    borderColor: c.ink,
  },
  stampText: { fontSize: 8, color: c.ink, textAlign: "center" },
  passportPage: { gap: 22 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  learningCard: {
    flexGrow: 1,
    flexBasis: 220,
    maxWidth: 350,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 22,
    overflow: "hidden",
  },
  learningPhoto: { width: "100%", height: 160 },
  cardLock: { alignItems: "center", justifyContent: "center" },
  learningCopy: { padding: 18, gap: 8 },
  bonusIntro: { gap: 12, maxWidth: 650 },
  bonusCard: {
    flexBasis: 240,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 24,
    padding: 22,
    gap: 14,
  },
  bonusIcon: {
    width: 50,
    height: 50,
    backgroundColor: c.lime,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  bonusLink: {
    color: c.ink,
    fontSize: 13,
    fontWeight: "800",
    marginTop: "auto",
  },
  error: { backgroundColor: c.peach, padding: 18, borderRadius: 18, gap: 14 },
  errorText: { color: c.danger, fontSize: 13, lineHeight: 20 },
  pressed: { opacity: 0.7 },
  scrim: {
    flex: 1,
    backgroundColor: "#172642BB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  bonusDialog: {
    backgroundColor: c.paper,
    borderRadius: 28,
    width: "100%",
    maxWidth: 500,
    maxHeight: "100%",
    overflow: "hidden",
  },
  bonusDialogContent: { padding: 24, gap: 18 },
  search: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 14,
    minHeight: 50,
    color: c.ink,
    fontSize: 14,
  },
  placeOption: {
    minHeight: 52,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: c.border,
  },
  claimed: {
    padding: 24,
    backgroundColor: c.lime,
    borderRadius: 20,
    gap: 12,
    alignItems: "center",
  },
});
