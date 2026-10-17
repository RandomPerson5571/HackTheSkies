import { useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { categories, places, type Category } from "../../restaurants/data/places";

import { colors } from "../../../theme/index";

const foodTypes = categories.filter(
  (item): item is Exclude<Category, "All"> => item !== "All",
);
const diets = ["No preference", "Vegetarian", "Vegan", "Pescatarian"] as const;
type Diet = (typeof diets)[number];
export type Profile = { name: string; neighborhood: string; diet: Diet };

type Point = { x: number; y: number };
function Line({
  from,
  to,
  color = colors.border,
  width = 1,
}: {
  from: Point;
  to: Point;
  color?: string;
  width?: number;
}) {
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  if (!length) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: (from.x + to.x - length) / 2,
        top: (from.y + to.y - width) / 2,
        width: length,
        height: width,
        backgroundColor: color,
        transform: [
          { rotate: `${Math.atan2(to.y - from.y, to.x - from.x)}rad` },
        ],
      }}
    />
  );
}

function FoodRadar({ counts, total }: { counts: number[]; total: number }) {
  const directions = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  const points = directions.map((direction, index) => ({
    x: 140 + direction.x * 84 * (total ? counts[index]! / total : 0),
    y: 126 + direction.y * 84 * (total ? counts[index]! / total : 0),
  }));
  return (
    <View
      accessible
      accessibilityLabel={`Food type radar chart. Percentage of saved places: ${foodTypes.map((type, index) => `${type} ${total ? Math.round((counts[index]! / total) * 100) : 0} percent`).join(", ")}. Scale zero to one hundred percent.`}
      style={styles.chart}
    >
      {[0.25, 0.5, 0.75, 1].map((scale) => (
        <View
          key={scale}
          style={[
            styles.radarRing,
            {
              width: 84 * Math.SQRT2 * scale,
              height: 84 * Math.SQRT2 * scale,
              left: 140 - 42 * Math.SQRT2 * scale,
              top: 126 - 42 * Math.SQRT2 * scale,
            },
          ]}
        />
      ))}
      <Line from={{ x: 140, y: 42 }} to={{ x: 140, y: 210 }} />
      <Line from={{ x: 56, y: 126 }} to={{ x: 224, y: 126 }} />
      {points.map((point, index) => (
        <Line
          key={index}
          from={point}
          to={points[(index + 1) % points.length]!}
          color={colors.accent}
          width={2}
        />
      ))}
      {points.map((point, index) => (
        <View
          key={index}
          style={[styles.chartDot, { left: point.x - 4, top: point.y - 4 }]}
        />
      ))}
      <Text style={[styles.axisLabel, { top: 10, left: 100 }]}>Coffee</Text>
      <Text style={[styles.axisLabel, { top: 118, right: -2, width: 48 }]}>
        Pizza
      </Text>
      <Text style={[styles.axisLabel, { bottom: 7, left: 100 }]}>Bakery</Text>
      <Text style={[styles.axisLabel, { top: 118, left: -2, width: 48 }]}>
        Ramen
      </Text>
    </View>
  );
}

export function ProfileScreen({
  saved,
  profile,
  onSave,
  topInset,
  bottomInset,
}: {
  saved: string[];
  profile: Profile;
  onSave: (profile: Profile) => void;
  topInset: number;
  bottomInset: number;
}) {
  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState("");
  const savedPlaces = places.filter((place) => saved.includes(place.id));
  const counts = foodTypes.map(
    (type) => savedPlaces.filter((place) => place.category === type).length,
  );
  const typesSaved = counts.filter(Boolean).length;
  const neighborhoods = new Set(savedPlaces.map((place) => place.neighborhood))
    .size;
  function update(change: Partial<Profile>) {
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
    onSave(next);
    setMessage("Profile updated for this session.");
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
      <Text style={styles.eyebrow}>YOUR OWN LITTLE FOOD WORLD</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Your profile.
      </Text>
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.initial}>
            {profile.name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.copy}>
            {profile.neighborhood || "Pick a neighborhood below"}
          </Text>
          <Text style={styles.tag}>
            {profile.diet === "No preference"
              ? "Open to every craving"
              : profile.diet}
          </Text>
        </View>
      </View>
      <View style={styles.stats}>
        {[
          { value: savedPlaces.length, label: "Saved spots" },
          { value: typesSaved, label: "Food types" },
          { value: neighborhoods, label: "Neighborhoods" },
        ].map((stat) => (
          <View key={stat.label} style={styles.stat}>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons
            name="analytics-outline"
            color={colors.accent}
            size={21}
            accessible={false}
          />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Your taste, mapped out
          </Text>
        </View>
        <Text style={styles.copy}>
          The food types you bookmark, as a share of your saved spots.
        </Text>
        <FoodRadar counts={counts} total={savedPlaces.length} />
        <Text style={styles.scale}>Each ring = 25% · Outer ring = 100%</Text>
        <View style={styles.breakdown}>
          {foodTypes.map((type, index) => (
            <View key={type} style={styles.breakdownRow}>
              <Text style={styles.label}>{type}</Text>
              <Text style={styles.copy}>
                {counts[index]} saved ·{" "}
                {savedPlaces.length
                  ? Math.round((counts[index]! / savedPlaces.length) * 100)
                  : 0}
                %
              </Text>
            </View>
          ))}
        </View>
        {!savedPlaces.length && (
          <Text style={styles.hint}>
            Your taste story starts with a save. Bookmark a spot in Explore to
            bring this chart to life.
          </Text>
        )}
      </View>
      <View style={styles.card}>
        <View style={styles.heading}>
          <Ionicons
            name="options-outline"
            color={colors.accent}
            size={21}
            accessible={false}
          />
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Make yourself at home
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
              onPress={() => update({ diet })}
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
        <Text style={styles.copy}>
          A note for your profile. Places aren’t filtered by dietary preference.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={save}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>Save settings</Text>
          <Ionicons
            name="checkmark"
            color={colors.white}
            size={19}
            accessible={false}
          />
        </Pressable>
        {message ? (
          <Text accessibilityRole="alert" style={styles.hint}>
            {message}
          </Text>
        ) : null}
        <Text style={styles.copy}>
          Profile settings stay here for your current session.
        </Text>
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
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  title: {
    color: colors.ink,
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1,
    marginTop: -10,
  },
  identity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 8,
  },
  avatar: {
    width: 70,
    height: 70,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { color: colors.accent, fontSize: 30, fontWeight: "600" },
  name: { color: colors.ink, fontSize: 23, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  tag: { color: colors.accent, fontSize: 12, fontWeight: "600", marginTop: 3 },
  stats: {
    flexDirection: "row",
    backgroundColor: colors.tint,
    borderRadius: 22,
    paddingVertical: 20,
  },
  stat: { flex: 1, alignItems: "center", gap: 5 },
  statValue: { color: colors.accent, fontSize: 26, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 10 },
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
  chart: { width: 280, height: 252, alignSelf: "center" },
  radarRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: "45deg" }],
  },
  chartDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  axisLabel: {
    position: "absolute",
    width: 80,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
  },
  scale: { color: colors.muted, fontSize: 10, textAlign: "center" },
  breakdown: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 14,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  label: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  hint: { color: colors.accent, fontSize: 12, lineHeight: 19 },
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
