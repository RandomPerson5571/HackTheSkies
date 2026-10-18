import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CatalogPhoto } from "./CatalogPhoto";
import { catalogPhoto } from "../services/catalogPhotos";
import { dishNumber, findCatalogDish, type FoodEntry } from "../models/foodDex";
import { cardTier, cardTiers } from "../models/discovery";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { colors, discoveryColors as c } from "../../../theme";

export function DiscoveryCard({
  entry,
  entrance = false,
  onLight = false,
}: {
  entry: FoodEntry;
  entrance?: boolean;
  onLight?: boolean;
}) {
  const reduced = useReducedMotion();
  const [flip] = useState(() => new Animated.Value(entrance ? 0 : 1));
  const [burst] = useState(() => new Animated.Value(0));
  const [back, setBack] = useState(false);
  const [entering, setEntering] = useState(entrance);
  const entranceDone = useRef(!entrance);
  const tier = cardTier(entry.name, entry.cuisine);
  const palette = cardTiers[tier];
  const dish = findCatalogDish(entry.name, entry.cuisine);
  const number = dish ? dishNumber(dish) : null;

  useEffect(() => {
    if (reduced === null || !entrance || entranceDone.current) return;
    flip.setValue(reduced ? 1 : 0);
    burst.setValue(0);
    if (reduced) {
      // Scheduling completion also keeps React's effect free of synchronous UI updates.
      const frame = requestAnimationFrame(() => {
        entranceDone.current = true;
        setEntering(false);
      });
      return () => cancelAnimationFrame(frame);
    }
    const animation = Animated.parallel([
      Animated.timing(flip, {
        toValue: 1,
        duration: 950,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(480),
        Animated.timing(burst, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start(({ finished }) => {
      if (finished) {
        entranceDone.current = true;
        setEntering(false);
      }
    });
    return () => animation.stop();
  }, [reduced, entrance, flip, burst]);

  function turn() {
    if (entering) return;
    const next = !back;
    setBack(next);
    Animated.timing(flip, {
      toValue: next ? 0 : 1,
      duration: reduced ? 0 : 500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }
  return (
    <View style={s.wrapper}>
      <View
        pointerEvents="none"
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[StyleSheet.absoluteFill, { zIndex: 2 }]}
      >
        {!reduced &&
          Array.from({ length: 28 }, (_, i) => {
            const angle = (i / 28) * Math.PI * 2;
            const distance = 140 + (i % 4) * 24;
            return (
              <Animated.View
                key={i}
                style={[
                  s.particle,
                  {
                    backgroundColor: [palette.color, c.glow, c.light][i % 3],
                    opacity: burst.interpolate({
                      inputRange: [0, 0.1, 0.7, 1],
                      outputRange: [0, 1, 1, 0],
                    }),
                    transform: [
                      {
                        translateX: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, Math.cos(angle) * distance],
                        }),
                      },
                      {
                        translateY: burst.interpolate({
                          inputRange: [0, 0.6, 1],
                          outputRange: [
                            0,
                            Math.sin(angle) * distance,
                            Math.sin(angle) * distance + 65,
                          ],
                        }),
                      },
                      {
                        rotate: burst.interpolate({
                          inputRange: [0, 1],
                          outputRange: ["0deg", `${i * 35}deg`],
                        }),
                      },
                    ],
                  },
                ]}
              />
            );
          })}
      </View>
      <Animated.View
        accessibilityElementsHidden={back || entering}
        importantForAccessibility={
          back || entering ? "no-hide-descendants" : "auto"
        }
        style={[
          s.card,
          {
            borderColor: palette.color,
            opacity: flip.interpolate({
              inputRange: [0, 0.49, 0.5, 1],
              outputRange: [0, 0, 1, 1],
            }),
            transform: [
              { perspective: 1000 },
              {
                rotateY: flip.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["180deg", "360deg"],
                }),
              },
            ],
          },
        ]}
      >
        <View style={s.cardTop}>
          <Text style={s.serial}>
            {number
              ? `NO. ${String(number).padStart(3, "0")}`
              : "YOUR ORIGINAL"}
          </Text>
          <View style={[s.tier, { backgroundColor: palette.color }]}>
            <Ionicons
              name="sparkles"
              size={12}
              color={palette.ink}
              accessible={false}
            />
            <Text style={[s.tierText, { color: palette.ink }]}>
              {tier.toUpperCase()}
            </Text>
          </View>
        </View>
        <CatalogPhoto
          eager
          source={catalogPhoto(dish)}
          fallbackSource={entry.photo ? { uri: entry.photo } : undefined}
          label={entry.name}
          style={s.photo}
        />
        <View style={s.cardBody}>
          <View style={s.stars}>
            {Array.from({ length: palette.stars }, (_, i) => (
              <Ionicons
                key={i}
                name="star"
                size={13}
                color={palette.color}
                accessible={false}
              />
            ))}
            <Text style={s.small}>FOOD DEX COLLECTION</Text>
          </View>
          <Text style={s.name}>{entry.name}</Text>
          <View style={s.cardBottom}>
            <Text style={s.cuisine}>{entry.cuisine}</Text>
            <Ionicons
              name="checkmark-circle"
              size={22}
              color={palette.color}
              accessible={false}
            />
          </View>
        </View>
      </Animated.View>
      <Animated.View
        pointerEvents={back ? "auto" : "none"}
        accessibilityElementsHidden={!back}
        importantForAccessibility={!back ? "no-hide-descendants" : "auto"}
        style={[
          s.card,
          s.back,
          {
            borderColor: palette.color,
            opacity: flip.interpolate({
              inputRange: [0, 0.49, 0.5, 1],
              outputRange: [1, 1, 0, 0],
            }),
            transform: [
              { perspective: 1000 },
              {
                rotateY: flip.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          },
        ]}
      >
        <ScrollView nestedScrollEnabled contentContainerStyle={s.backContent}>
          {entering ? (
            <>
              <Ionicons
                name="restaurant-outline"
                size={64}
                color={palette.color}
                accessible={false}
              />
              <Text style={s.backBrand}>CIBO</Text>
              <Text style={s.small}>A WORLD WORTH TASTING</Text>
            </>
          ) : (
            <>
              <Ionicons
                name="earth-outline"
                size={32}
                color={palette.color}
                accessible={false}
              />
              <Text style={s.small}>BEHIND THE BITE</Text>
              <Text style={s.name}>{entry.name}</Text>
              {entry.review ? (
                <>
                  <Text style={[s.small, s.plainText]}>YOUR REVIEW</Text>
                  <Text style={s.review}>{`“${entry.review}”`}</Text>
                </>
              ) : null}
              <Text style={s.story}>
                {dish?.note ??
                  "A discovery of your own. Every meal adds a new chapter to your culinary story."}
              </Text>
              <Text style={s.cuisine}>
                {dish?.regions.join(" · ") || entry.cuisine}
              </Text>
              <View style={s.rule} />
              <Text style={s.small}>
                DISCOVERED{" "}
                {new Date(entry.discoveredAt)
                  .toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  .toUpperCase()}
              </Text>
              {entry.location ? <Text style={s.small}>{entry.location}</Text> : null}
              <Text style={s.tierNote}>
                Card tiers are for collecting. Every cuisine is worth exploring.
              </Text>
            </>
          )}
        </ScrollView>
      </Animated.View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          back ? "Show food card photo" : "Flip card to read the dish story"
        }
        disabled={entering}
        accessibilityState={{ disabled: entering }}
        onPress={turn}
        style={({ pressed }) => [s.flip, pressed && { opacity: 0.6 }]}
      >
        <Ionicons
          name="sync-outline"
          size={16}
          color={onLight ? colors.muted : c.muted}
          accessible={false}
        />
        <Text style={[s.flipText, onLight && { color: colors.muted }]}>
          {entering
            ? "A new chapter begins…"
            : back
              ? "Back to your card"
              : "Flip to discover the story"}
        </Text>
      </Pressable>
    </View>
  );
}
const s = StyleSheet.create({
  wrapper: { width: "100%", maxWidth: 340, alignSelf: "center" },
  card: {
    backgroundColor: c.night,
    borderWidth: 2,
    borderRadius: 24,
    overflow: "hidden",
    backfaceVisibility: "hidden",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    padding: 16,
  },
  serial: {
    color: c.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.6,
  },
  tier: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  tierText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  photo: { width: "100%", height: 204 },
  cardBody: { padding: 20, gap: 12 },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 4,
  },
  small: {
    color: c.muted,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    lineHeight: 16,
  },
  name: {
    color: c.light,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  cuisine: { color: c.muted, fontSize: 13, lineHeight: 21, flexShrink: 1 },
  back: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 48,
  },
  backContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
    gap: 16,
  },
  backBrand: {
    fontSize: 42,
    fontWeight: "800",
    letterSpacing: 10,
    color: c.light,
  },
  story: { color: c.light, fontSize: 15, lineHeight: 23, textAlign: "center" },
  review: {
    color: c.light,
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    fontStyle: "italic",
  },
  plainText: { color: c.muted },
  rule: { height: 1, width: "100%", backgroundColor: c.line },
  tierNote: {
    color: c.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: "center",
  },
  flip: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  flipText: { color: c.muted, fontSize: 12 },
  particle: {
    position: "absolute",
    left: "50%",
    top: "45%",
    width: 5,
    height: 10,
    borderRadius: 2,
    zIndex: 2,
  },
});
