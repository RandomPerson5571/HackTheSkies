import { useEffect, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { colors } from "../../../theme";

export function CollectionProgress({
  value,
  from = value,
  color = colors.accent,
  trackColor = colors.border,
}: {
  value: number;
  from?: number;
  color?: string;
  trackColor?: string;
}) {
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(from));
  useEffect(() => {
    if (reduced === null) return;
    const animation = Animated.timing(progress, {
      toValue: Math.max(0, Math.min(1, value)),
      duration: reduced ? 0 : 800,
      delay: reduced ? 0 : 250,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [value, progress, reduced]);
  return (
    <View
      accessible
      accessibilityLabel="Collection completion"
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      style={[s.track, { backgroundColor: trackColor }]}
    >
      <Animated.View
        style={[
          s.fill,
          {
            backgroundColor: color,
            width: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}
const s = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
});
