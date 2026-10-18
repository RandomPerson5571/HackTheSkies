import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/index";
import { BADGES, type BadgeId } from "../../gamification/models/gamification";
import {
  avatarPalettes,
  ranks,
  type Customization,
} from "../models/customization";
import { DecoratedAvatar, TrophyArt } from "./RewardArt";

export function ProfileWardrobe({
  name,
  selected,
  level,
  earned,
  onChange,
}: {
  name: string;
  selected: Customization;
  level: number;
  earned: ReadonlySet<BadgeId>;
  onChange: (change: Partial<Customization>) => void;
}) {
  const palette = avatarPalettes.find((item) => item.id === selected.palette)!;
  return (
    <View style={s.card}>
      <Text style={s.title}>Make it yours</Text>
      <Text style={s.copy}>
        A little flavor for your passport. Your choices save automatically.
      </Text>
      <Text accessibilityRole="header" style={s.label}>
        AVATAR DECORATION
      </Text>
      <Text style={s.copy}>
        Auto follows your rank. Earn XP to unlock more frames.
      </Text>
      <ScrollView
        accessibilityRole="radiogroup"
        accessibilityLabel="Avatar decoration"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {(["auto", "none"] as const).map((id) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={
              id === "auto"
                ? "Automatic rank decoration"
                : "No avatar decoration"
            }
            aria-checked={selected.frame === id}
            accessibilityState={{ checked: selected.frame === id }}
            onPress={() => onChange({ frame: id })}
            style={({ pressed }) => [
              s.option,
              selected.frame === id && s.selected,
              pressed && s.pressed,
            ]}
          >
            <Ionicons
              name={id === "auto" ? "sparkles-outline" : "ellipse-outline"}
              size={28}
              color={colors.ink}
              accessible={false}
            />
            <Text style={s.optionName}>
              {id === "auto" ? "Auto rank" : "No frame"}
            </Text>
            <Text style={s.meta}>
              {selected.frame === id ? "Selected" : "Always available"}
            </Text>
          </Pressable>
        ))}
        {ranks.map((rank) => {
          const locked = level < rank.level;
          const checked = selected.frame === rank.id;
          return (
            <Pressable
              key={rank.id}
              accessibilityRole="radio"
              disabled={locked}
              accessibilityLabel={`${rank.name} frame, ${locked ? `unlocks at level ${rank.level}` : "unlocked"}`}
              aria-checked={checked}
              accessibilityState={{ checked, disabled: locked }}
              onPress={() => onChange({ frame: rank.id })}
              style={({ pressed }) => [
                s.option,
                checked && !locked && s.selected,
                locked && s.locked,
                pressed && s.pressed,
              ]}
            >
              <DecoratedAvatar
                name={name}
                frame={rank.id}
                palette={palette}
                size={76}
              />
              <Text style={s.optionName}>{rank.name}</Text>
              <Text style={s.meta}>
                {locked
                  ? `Locked · Lv ${rank.level}`
                  : checked
                    ? "Selected"
                    : `Unlocked · Lv ${rank.level}`}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Text accessibilityRole="header" style={s.label}>
        AVATAR COLOR
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Avatar color"
        style={s.paletteRow}
      >
        {avatarPalettes.map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="radio"
            accessibilityLabel={`${item.name} avatar color`}
            aria-checked={selected.palette === item.id}
            accessibilityState={{ checked: selected.palette === item.id }}
            onPress={() => onChange({ palette: item.id })}
            style={({ pressed }) => [
              s.palette,
              { backgroundColor: item.background },
              selected.palette === item.id && { borderColor: colors.ink },
              pressed && s.pressed,
            ]}
          >
            <Text style={[s.optionName, { color: item.foreground }]}>
              {item.name}
            </Text>
            {selected.palette === item.id && (
              <Ionicons
                name="checkmark"
                size={16}
                color={item.foreground}
                accessible={false}
              />
            )}
          </Pressable>
        ))}
      </View>
      <Text accessibilityRole="header" style={s.label}>
        FEATURED TROPHY
      </Text>
      <Text style={s.copy}>Pin an earned trophy beside your name.</Text>
      <ScrollView
        accessibilityRole="radiogroup"
        accessibilityLabel="Featured trophy"
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
      >
        {(["auto", "none"] as const).map((id) => (
          <Pressable
            key={id}
            accessibilityRole="radio"
            accessibilityLabel={
              id === "auto"
                ? "Automatically feature a trophy"
                : "Hide featured trophy"
            }
            aria-checked={selected.featuredBadge === id}
            accessibilityState={{ checked: selected.featuredBadge === id }}
            onPress={() => onChange({ featuredBadge: id })}
            style={({ pressed }) => [
              s.option,
              selected.featuredBadge === id && s.selected,
              pressed && s.pressed,
            ]}
          >
            <Ionicons
              name={id === "auto" ? "ribbon-outline" : "remove-outline"}
              size={28}
              color={colors.ink}
              accessible={false}
            />
            <Text style={s.optionName}>
              {id === "auto" ? "Auto trophy" : "No trophy"}
            </Text>
          </Pressable>
        ))}
        {BADGES.filter((badge) => earned.has(badge.id)).map((badge) => (
          <Pressable
            key={badge.id}
            accessibilityRole="radio"
            accessibilityLabel={`Feature ${badge.name} trophy`}
            aria-checked={selected.featuredBadge === badge.id}
            accessibilityState={{
              checked: selected.featuredBadge === badge.id,
            }}
            onPress={() => onChange({ featuredBadge: badge.id })}
            style={({ pressed }) => [
              s.option,
              selected.featuredBadge === badge.id && s.selected,
              pressed && s.pressed,
            ]}
          >
            <TrophyArt id={badge.id} size={66} />
            <Text style={s.optionName}>{badge.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {earned.size === 0 && (
        <Text style={s.copy}>
          Discover your first dish to unlock your first trophy.
        </Text>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    backgroundColor: colors.white,
  },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  label: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginTop: 8,
  },
  row: { gap: 10, paddingVertical: 3 },
  option: {
    width: 118,
    minHeight: 134,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 18,
    padding: 10,
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.paper,
  },
  selected: { borderColor: colors.ink, backgroundColor: colors.tint },
  locked: { backgroundColor: colors.border },
  optionName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  meta: { color: colors.muted, fontSize: 10, textAlign: "center" },
  paletteRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  palette: {
    minHeight: 48,
    minWidth: 90,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pressed: { opacity: 0.65 },
});
