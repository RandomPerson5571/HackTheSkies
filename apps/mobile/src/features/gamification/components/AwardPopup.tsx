import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { discoveryColors as c } from "../../../theme";
import { playFeedback } from "../../../lib/sensory";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";

import type { Award } from "../models/discoveryAwards";
export type { Award } from "../models/discoveryAwards";
export function AwardPopup({
  award,
  remaining = 0,
  onContinue,
}: {
  award?: Award;
  remaining?: number;
  onContinue: () => void;
}) {
  const reduced = useReducedMotion();
  const [entrance] = useState(() => new Animated.Value(1));
  const [celebration] = useState(() => new Animated.Value(1));
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!award || reduced === null) return;
    if (played.current !== award.id) {
      played.current = award.id;
      void playFeedback(
        award.kind === "level"
          ? "levelup"
          : award.kind === "quest"
            ? "chest"
            : "badge",
      );
    }
    entrance.setValue(reduced ? 1 : 0);
    celebration.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.parallel([Animated.timing(entrance, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }), Animated.sequence([
      Animated.delay(180),
      Animated.timing(celebration, {
        toValue: 1,
        duration: award.kind === "level" ? 1100 : 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ])]);
    animation.start();
    return () => animation.stop();
  }, [award, reduced, entrance, celebration]);
  if (!award) return null;
  return (
    <Modal
      transparent
      visible
      animationType={reduced === false ? "fade" : "none"}
      onRequestClose={onContinue}
      statusBarTranslucent
    >
      <View style={s.overlay} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={s.center}>
          <Animated.View
            style={[
              s.card,
              {
                opacity: reduced === null ? 1 : entrance,
                transform: [
                  {
                    scale: entrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.86, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={s.art} accessible={false}>
              {Array.from({ length: 12 }, (_, index) => {
                const angle = (index * Math.PI) / 6;
                return (
                  <Animated.View
                    key={index}
                    style={[
                      s.spark,
                      {
                        backgroundColor: index % 2 ? c.gold : c.glow,
                        opacity: reduced !== false ? 1 : celebration.interpolate({
                          inputRange: [0, 0.2, 0.75, 1],
                          outputRange: [0, 1, 1, 0],
                        }),
                        transform: [
                          {
                            translateX: celebration.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, Math.cos(angle) * 108],
                            }),
                          },
                          {
                            translateY: celebration.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, Math.sin(angle) * 108],
                            }),
                          },
                          { rotate: `${index * 30}deg` },
                        ],
                      },
                    ]}
                  />
                );
              })}
              <Animated.View style={[s.medal, {
                transform: [
                  { scale: celebration.interpolate({
                    inputRange: [0, 0.35, 0.65, 1],
                    outputRange: [1, 1.16, 0.96, 1],
                  }) },
                  { rotate: celebration.interpolate({
                    inputRange: [0, 0.25, 0.5, 0.75, 1],
                    outputRange: award.kind === "quest"
                      ? ["-12deg", "10deg", "-6deg", "3deg", "0deg"]
                      : ["0deg", "0deg", "0deg", "0deg", "0deg"],
                  }) },
                ],
              }]}>
                <Ionicons
                  name={
                    award.kind === "level"
                      ? "flash"
                      : award.kind === "quest"
                        ? "trophy"
                        : "ribbon"
                  }
                  size={64}
                  color={c.night}
                />
              </Animated.View>
            </View>
            <Text style={s.eyebrow}>
              {award.kind === "level"
                ? "LEVEL UP"
                : award.kind === "quest"
                  ? "QUEST COMPLETE"
                  : "BADGE UNLOCKED"}
            </Text>
            <Text
              accessibilityRole="header"
              accessibilityLiveRegion="polite"
              style={s.title}
            >
              {award.title}
            </Text>
            <Text style={s.subtitle}>{award.subtitle}</Text>
            {!!award.xp && (
              <View style={s.xp}>
                <Ionicons name="sparkles" size={18} color={c.gold} />
                <Text style={s.xpText}>+{award.xp} XP</Text>
              </View>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={onContinue}
              style={({ pressed }) => [s.button, pressed && { opacity: 0.75 }]}
            >
              <Text style={s.buttonText}>
                {remaining ? `Next reward · ${remaining}` : "Let's go!"}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={c.night} />
            </Pressable>
          </Animated.View>
        </ScrollView>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(10,18,33,0.88)" },
  center: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    paddingVertical: 60,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 28,
    alignItems: "center",
    gap: 16,
  },
  art: {
    width: 240,
    height: 240,
    alignItems: "center",
    justifyContent: "center",
  },
  medal: {
    width: 144,
    height: 144,
    borderRadius: 72,
    backgroundColor: c.gold,
    borderWidth: 8,
    borderColor: c.glow,
    alignItems: "center",
    justifyContent: "center",
  },
  spark: { position: "absolute", width: 8, height: 14, borderRadius: 3 },
  eyebrow: { color: c.gold, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  title: {
    color: c.light,
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: c.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  xp: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: c.night,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  xpText: { color: c.gold, fontSize: 21, fontWeight: "800" },
  button: {
    minHeight: 52,
    width: "100%",
    backgroundColor: c.glow,
    borderRadius: 28,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  buttonText: { color: c.night, fontSize: 15, fontWeight: "700" },
});
