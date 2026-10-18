import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { colors as c } from "../../../theme";
import { frames } from "../../profile/components/rewardSources";
import type { playerProgress } from "../../gamification/models/playerProgress";

export function QuestLevelBar({
  progress,
}: {
  progress: ReturnType<typeof playerProgress>;
}) {
  const { level, rank, xp } = progress;
  return (
    <View style={s.container}>
      <View style={s.badge} accessible={false}>
        <Image
          source={frames[rank.id]}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
        />
        <Text style={s.level}>{level}</Text>
      </View>
      <View style={s.details}>
        <View style={s.heading}>
          <Text style={s.title}>{rank.name}</Text>
          <Text style={s.meta}>Lv {level}</Text>
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={`Level ${level}, ${rank.name}, XP to next level`}
          accessibilityValue={{ min: 0, max: xp.needed, now: xp.current }}
          style={s.track}
        >
          <View
            style={[s.fill, { width: `${(xp.current / xp.needed) * 100}%` }]}
          />
        </View>
        <Text style={s.meta}>
          {xp.current}/{xp.needed} XP · Level {level + 1}
        </Text>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    paddingVertical: 12,
  },
  badge: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  level: { fontSize: 23, fontWeight: "800", color: c.ink },
  details: { flex: 1, gap: 8 },
  heading: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "700", color: c.ink },
  meta: { fontSize: 12, color: c.muted },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: c.border,
  },
  fill: { height: "100%", backgroundColor: c.accent, borderRadius: 4 },
});
