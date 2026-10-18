import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../../theme/index";
import { playSound, hapticSuccess, hapticLight } from "../../../lib/sensory";
import type { Profile } from "../models/profile";
export type { Profile } from "../models/profile";

import { useFoodDex } from "../../food-dex/hooks/useFoodDex";
import {
  cuisines,
  dishes,
  type Cuisine,
} from "../../food-dex/models/foodDex";
import { useGamification } from "../../gamification/hooks/useGamification";
import {
  BADGES,
  xpToNextLevel,
} from "../../gamification/models/gamification";

const diets = ["No preference", "Vegetarian", "Vegan", "Pescatarian"] as const;

const trainerTitles = [
  { minLevel: 20, title: "Master Explorer" },
  { minLevel: 15, title: "Cuisine Connoisseur" },
  { minLevel: 10, title: "Seasoned Taster" },
  { minLevel: 5, title: "Adventurous Eater" },
  { minLevel: 1, title: "Food Explorer" },
];

function trainerTitle(level: number) {
  return (
    trainerTitles.find((entry) => level >= entry.minLevel)?.title ??
    "Food Explorer"
  );
}

// Approximate positions for the stylized cuisine map (percentages).
const cuisineMapPosition: Record<Cuisine, { x: number; y: number }> = {
  American: { x: 18, y: 34 },
  Latin: { x: 24, y: 58 },
  Caribbean: { x: 28, y: 46 },
  French: { x: 46, y: 26 },
  Italian: { x: 50, y: 34 },
  Greek: { x: 54, y: 38 },
  Levant: { x: 58, y: 30 },
  Persian: { x: 62, y: 36 },
  "South Asian": { x: 68, y: 42 },
  Thai: { x: 76, y: 44 },
  Vietnamese: { x: 78, y: 40 },
  Chinese: { x: 78, y: 26 },
  Korean: { x: 82, y: 28 },
  Japanese: { x: 86, y: 30 },
  Other: { x: 50, y: 52 },
};

export function ProfileScreen({
  profile,
  onSave,
  topInset,
  bottomInset,
  storageError,
}: {
  saved: string[];
  profile: Profile;
  onSave: (profile: Profile) => void;
  topInset: number;
  bottomInset: number;
  storageError: string;
}) {
  const { entries } = useFoodDex();
  const { state: game } = useGamification();

  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState("");
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setDraft(profile);
  }, [profile]);

  const foodsCount = entries.length;
  const cuisinesCount = new Set(entries.map((entry) => entry.cuisine)).size;
  const streak = game.streak;
  const level = game.level;
  const title = trainerTitle(level);
  const xp = xpToNextLevel(game.xp);
  const xpPercent = Math.round((xp.current / xp.needed) * 100);

  const earnedBadgeIds = new Set(game.badges);
  const featuredBadges = [
    ...BADGES.filter((badge) => earnedBadgeIds.has(badge.id)),
    ...BADGES.filter((badge) => !earnedBadgeIds.has(badge.id)),
  ].slice(0, 4);

  const cuisineStats = cuisines
    .map((cuisine) => ({
      cuisine,
      done: entries.filter((entry) => entry.cuisine === cuisine).length,
      total: dishes.filter((dish) => dish.cuisine === cuisine).length,
    }))
    .sort((a, b) => b.done - a.done || a.cuisine.localeCompare(b.cuisine));
  const shownCuisines = cuisineStats.filter((item) => item.done > 0);
  const cuisineRows =
    shownCuisines.length > 0 ? shownCuisines.slice(0, 6) : cuisineStats.slice(0, 3);

  const recent = entries.slice(0, 6);

  function update(change: Partial<Profile>) {
    edited.current = true;
    setDraft((current) => ({ ...current, ...change }));
    setMessage("");
  }
  function save() {
    if (!draft.name.trim()) {
      setMessage("Please enter a display name.");
      return;
    }
    const next = {
      ...draft,
      name: draft.name.trim(),
      neighborhood: draft.neighborhood.trim(),
    };
    setDraft(next);
    edited.current = false;
    onSave(next);
    setMessage("Settings saved.");
    void playSound("success");
    hapticSuccess();
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 24, paddingBottom: bottomInset + 112 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.trainerCard}>
        <View style={styles.trainerTop}>
          <View style={styles.avatar}>
            <Text style={styles.initial}>
              {profile.name.trim().charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.handle}>@{profile.name.replace(/\s+/g, "").toLowerCase() || "foodexplorer"}</Text>
            <Text style={styles.titleLine}>
              Level {level} · {title}
            </Text>
          </View>
        </View>
        <View style={styles.xpBlock}>
          <View style={styles.xpRow}>
            <Text style={styles.xpText}>
              {xp.current.toLocaleString()} / {xp.needed.toLocaleString()} XP
            </Text>
            <Text style={styles.xpPercent}>{xpPercent}%</Text>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        {[
          { value: foodsCount, label: "Foods" },
          { value: cuisinesCount, label: "Cuisines" },
          { value: streak, label: "Day Streak" },
        ].map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons name="ribbon-outline" color={colors.accent} size={21} accessible={false} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Featured Badges
          </Text>
          <Text style={styles.link}>View all →</Text>
        </View>
        <View style={styles.badgeRow}>
          {featuredBadges.map((badge) => {
            const earned = earnedBadgeIds.has(badge.id);
            return (
              <View
                key={badge.id}
                style={[styles.badge, !earned && styles.badgeLocked]}
              >
                <Ionicons
                  name={badge.icon as any}
                  size={26}
                  color={earned ? colors.accent : colors.muted}
                  accessible={false}
                />
                <Text
                  style={[styles.badgeName, !earned && styles.badgeNameLocked]}
                  numberOfLines={1}
                >
                  {badge.name}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons name="globe-outline" color={colors.accent} size={21} accessible={false} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Cuisine Completion
          </Text>
          <Text style={styles.link}>Pokédex →</Text>
        </View>
        <View style={styles.cuisineRows}>
          {cuisineRows.map((row) => {
            const percent = row.total
              ? Math.round((row.done / row.total) * 100)
              : 0;
            return (
              <View key={row.cuisine} style={styles.cuisineRow}>
                <Ionicons name="flag-outline" size={22} color={colors.accent} accessible={false} />
                <View style={styles.flex}>
                  <View style={styles.cuisineLabelRow}>
                    <Text style={styles.cuisineName}>{row.cuisine}</Text>
                    <Text style={styles.cuisineCount}>
                      {row.done}/{row.total}
                    </Text>
                  </View>
                  <View style={styles.progressTrack}>
                    <View
                      style={[styles.progressFill, { width: `${percent}%` }]}
                    />
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons name="map-outline" color={colors.accent} size={21} accessible={false} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Cuisine Map
          </Text>
        </View>
        <Text style={styles.copy}>
          Where the cuisines you’ve discovered come from.
        </Text>
        <View style={styles.mapBox}>
          {cuisines.map((cuisine) => {
            const discovered = entries.some(
              (entry) => entry.cuisine === cuisine,
            );
            const pos = cuisineMapPosition[cuisine];
            return (
              <View
                key={cuisine}
                style={[
                  styles.mapPin,
                  {
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                  },
                  discovered ? styles.mapPinActive : styles.mapPinIdle,
                ]}
              >
                <Ionicons name="flag" size={14} color={colors.accent} accessible={false} />
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons name="time-outline" color={colors.accent} size={21} accessible={false} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Recent Discoveries
          </Text>
          <Text style={styles.link}>See all →</Text>
        </View>
        {recent.length === 0 ? (
          <Text style={styles.hint}>
            Discover your first dish in the Food Dex to fill this shelf.
          </Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recent.map((entry) => (
              <View key={entry.id} style={styles.recentCard}>
                <Ionicons name="flag-outline" size={28} color={colors.accent} accessible={false} />
                <Text style={styles.recentName} numberOfLines={1}>
                  {entry.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {storageError ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          {storageError}
        </Text>
      ) : null}
      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons name="options-outline" color={colors.accent} size={21} accessible={false} />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Trainer Settings
          </Text>
        </View>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          accessibilityLabel="Display name"
          style={styles.input}
          value={draft.name}
          onChangeText={(name) => update({ name })}
          maxLength={50}
          autoComplete="name"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
        />
        <Text style={styles.label}>Home neighborhood</Text>
        <TextInput
          accessibilityLabel="Home neighborhood"
          style={styles.input}
          value={draft.neighborhood}
          onChangeText={(neighborhood) => update({ neighborhood })}
          maxLength={80}
          placeholder="e.g. Kensington Market"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
        />
        <Text style={styles.label}>Dietary preference</Text>
        <View style={styles.choices}>
          {diets.map((diet) => (
            <Pressable
              key={diet}
              accessibilityRole="radio"
              accessibilityState={{ checked: draft.diet === diet }}
              onPress={() => {
                update({ diet });
                void playSound("tap");
                hapticLight();
              }}
              style={({ pressed }) => [
                styles.choice,
                draft.diet === diet && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  draft.diet === diet && styles.choiceTextSelected,
                ]}
              >
                {diet}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={save}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>Save settings</Text>
          <Ionicons name="checkmark" color={colors.white} size={19} accessible={false} />
        </Pressable>
        {message ? (
          <Text accessibilityRole="alert" style={styles.hint}>
            {message}
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 20,
    gap: 18,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  flex: { flex: 1, gap: 4 },
  trainerCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
    boxShadow: "0 6px 24px #3D568F12",
  },
  trainerTop: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.accent, fontSize: 30, fontWeight: "700" },
  name: { color: colors.ink, fontSize: 23, fontWeight: "700" },
  handle: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  titleLine: { color: colors.accent, fontSize: 13, fontWeight: "700", marginTop: 2 },
  xpBlock: { gap: 8 },
  xpRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  xpText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  xpPercent: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  xpTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.tint,
    overflow: "hidden",
  },
  xpFill: { height: "100%", borderRadius: 5, backgroundColor: colors.accent },
  stats: {
    flexDirection: "row",
    backgroundColor: colors.tint,
    borderRadius: 22,
    paddingVertical: 18,
  },
  stat: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { color: colors.accent, fontSize: 26, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  heading: { flexDirection: "row", gap: 9, alignItems: "center" },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "600", flex: 1 },
  link: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  hint: { color: colors.accent, fontSize: 12, lineHeight: 19 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: {
    width: "47%",
    borderRadius: 18,
    padding: 12,
    backgroundColor: colors.tint,
    alignItems: "center",
    gap: 6,
  },
  badgeLocked: { opacity: 0.45 },
  badgeEmoji: { fontSize: 26 },
  badgeName: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  badgeNameLocked: { color: colors.muted },
  cuisineRows: { gap: 12 },
  cuisineRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  cuisineFlag: { fontSize: 22 },
  cuisineLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  cuisineName: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  cuisineCount: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.tint,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.accent },
  mapBox: {
    height: 170,
    borderRadius: 18,
    backgroundColor: "#EAF3FF",
    borderWidth: 1,
    borderColor: colors.border,
    position: "relative",
    overflow: "hidden",
  },
  mapPin: {
    position: "absolute",
    width: 26,
    height: 26,
    marginLeft: -13,
    marginTop: -13,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  mapPinActive: {
    backgroundColor: colors.white,
    borderColor: colors.accent,
  },
  mapPinIdle: {
    backgroundColor: "#F2F2F2",
    borderColor: colors.border,
    opacity: 0.5,
  },
  mapPinEmoji: { fontSize: 14 },
  recentRow: { gap: 10, paddingVertical: 2 },
  recentCard: {
    width: 92,
    borderRadius: 16,
    padding: 10,
    backgroundColor: colors.tint,
    alignItems: "center",
    gap: 6,
  },
  recentEmoji: { fontSize: 28 },
  recentName: { color: colors.ink, fontSize: 11, fontWeight: "600" },
  label: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: colors.paper,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    minHeight: 48,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  choiceSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: colors.white },
  save: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  saveText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.65 },
});
