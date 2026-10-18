import { playFeedback } from "../../../lib/sensory";
import { useMenuSound } from "../../../hooks/useMenuSound";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { CiboLogo } from "../../../components/CiboLogo";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Place } from "../../restaurants/data/places";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";
import { useQuests } from "../hooks/useQuests";
import { challenges } from "../data/challenges";
import {
  bonusCount,
  bonusExpired,
  bonusTargets,
  claimBonus,
} from "../models/quests";
import { QuestButton } from "./QuestButton";
import { questColors as c } from "../../../theme";

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
export function QuestsScreen({
  places,
  onBack,
}: {
  places: Place[];
  onBack: () => void;
}) {
  const { state, ready, error, update, retry } = useQuests();
  const [bonusId, setBonusId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useMenuSound(bonusId !== null);

  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const totalXp = state.bonusXp;
  const bonus = challenges.find((item) => item.id === bonusId);
  const run = bonusId ? state.bonus[bonusId] : undefined;
  const expired = !!(bonusId && run && bonusExpired(bonusId, run));
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
                    <Ionicons name={challenge.icon} size={26} color={c.ink} />
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
      </ScrollView>
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
                      {bonus.points} XP added to your total. You can start
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
  cardTitle: { color: c.navy, fontWeight: "800", fontSize: 16, lineHeight: 22 },
  chapterTitle: {
    color: c.navy,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  meter: {
    height: 6,
    width: "100%",
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: c.border,
  },
  meterFill: { height: "100%", backgroundColor: c.ink, borderRadius: 6 },
  error: { backgroundColor: c.peach, padding: 18, borderRadius: 18, gap: 14 },
  bonusIntro: { gap: 12, maxWidth: 650 },
  cardGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
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
  panelTitle: { color: c.navy, fontSize: 17, fontWeight: "800", flexShrink: 1 },
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
