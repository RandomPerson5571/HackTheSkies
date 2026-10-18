import { useEffect, useState, type ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutRectangle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  Easing,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { cardTier, cardTiers } from "../models/discovery";
import { arrowToBox, type DishBounds } from "../models/foodTracking";
import type { FoodRecognition } from "../services/foodScanner";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { XP_PER_DISCOVERY } from "../../gamification/models/gamification";
import { cameraColors } from "../../../theme";

type Rect = { x: number; y: number; width: number; height: number };
export function DishOverlay({
  recognition,
  collected,
  catching,
  scanning = false,
  anchor,
  preview,
}: {
  recognition: FoodRecognition | null;
  scanning?: boolean;
  preview?: { width: number; height: number };
  anchor?: DishBounds;
  collected: boolean;
  catching: boolean;
}) {
  const reduced = useReducedMotion();
  const tier = recognition
    ? cardTier(recognition.name, recognition.cuisine)
    : cardTier("", "Other");
  const palette = cardTiers[tier];
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [cards, setCards] = useState<Record<string, LayoutRectangle>>({});
  const bounds = useSharedValue<Rect>({ x: 0, y: 0, width: 0, height: 0 });
  const visible = useSharedValue(0);
  const caught = useSharedValue(0);
  const clock = useSharedValue(0);
  useEffect(() => {
    clock.value =
      reduced === false
        ? withRepeat(
            withTiming(Math.PI * 2, { duration: 6500, easing: Easing.linear }),
            -1,
          )
        : 0;
    return () => cancelAnimation(clock);
  }, [clock, reduced]);
  useEffect(() => {
    const b = anchor ?? {
      x: 0.28,
      y: 0.3,
      width: 0.44,
      height: 0.25,
      visible: true,
    };
    const w = preview?.width || size.width;
    const h = preview?.height || size.height;
    bounds.value = withTiming(
      { x: b.x * w, y: b.y * h, width: b.width * w, height: b.height * h },
      { duration: reduced === false ? 140 : 0 },
    );
    visible.value = withTiming(b.visible ? 1 : 0, { duration: 220 });
  }, [anchor, bounds, preview, reduced, size, visible]);
  useEffect(() => {
    caught.value = withTiming(catching ? 1 : 0, {
      duration: reduced === false ? 650 : 0,
    });
  }, [catching, caught, reduced]);
  const particles = useAnimatedStyle(() => ({
    opacity: visible.value * (1 - caught.value),
    left: bounds.value.x + bounds.value.width / 2,
    top: bounds.value.y + bounds.value.height / 2,
  }));
  const labels = [
    {
      id: "dish",
      position: s.topLeft,
      content: (
        <>
          <Text style={s.name}>
            {recognition?.name ?? "Finding your dish…"}
          </Text>
          <Text style={s.cuisine}>
            {recognition
              ? `${recognition.cuisine} cuisine`
              : "Keep your dish in view"}
          </Text>
        </>
      ),
    },
    {
      id: "status",
      position: s.topRight,
      content: (
        <>
          <Ionicons
            name={collected ? "checkmark-circle" : "sparkles"}
            size={18}
            color={palette.color}
            accessible={false}
          />
          <Text style={[s.status, { color: palette.color }]}>
            {scanning
              ? "LIVE SCAN"
              : collected
                ? "IN YOUR DEX"
                : "NEW DISCOVERY!"}
          </Text>
        </>
      ),
    },
    {
      id: "rarity",
      position: s.bottomLeft,
      content: (
        <>
          <Text style={s.caption}>RARITY</Text>
          <Text style={[s.tier, { color: palette.color }]}>
            {scanning
              ? "Identifying…"
              : `${tier} · ${"★".repeat(palette.stars)}`}
          </Text>
        </>
      ),
    },
    {
      id: "xp",
      position: s.bottomRight,
      content: (
        <>
          <Text style={[s.xp, { color: palette.color }]}>
            {scanning
              ? "Hold steady"
              : collected
                ? "Collected"
                : `+${XP_PER_DISCOVERY} XP`}
          </Text>
          <Text style={s.caption}>
            {scanning ? "A little food magic" : "On discovery"}
          </Text>
        </>
      ),
    },
  ];
  return (
    <View
      pointerEvents="none"
      style={s.position}
      onLayout={({ nativeEvent: { layout } }) =>
        setSize({ width: layout.width, height: layout.height })
      }
    >
      {labels.map(({ id, position, content }, index) => (
        <View
          key={id}
          style={[s.labelSlot, position]}
          onLayout={({ nativeEvent: { layout } }) =>
            setCards((old) => ({ ...old, [id]: layout }))
          }
        >
          <FloatingCard
            index={index}
            clock={clock}
            caught={caught}
            reduced={reduced !== false}
            color={palette.color}
          >
            {content}
          </FloatingCard>
        </View>
      ))}
      {Object.entries(cards).map(([id, card]) => (
        <TrackingArrow
          key={id}
          card={card}
          index={["dish", "status", "rarity", "xp"].indexOf(id)}
          clock={clock}
          caught={caught}
          bounds={bounds}
          visible={visible}
          color={palette.color}
          reduced={reduced !== false}
        />
      ))}
      <Animated.View style={[s.particles, particles]}>
        {Array.from({ length: 24 }, (_, index) => (
          <Spark
            key={index}
            index={index}
            clock={clock}
            bounds={bounds}
            caught={caught}
            color={palette.color}
            reduced={reduced !== false}
          />
        ))}
        {[0, 1].map((index) => (
          <Ripple
            key={index}
            index={index}
            clock={clock}
            bounds={bounds}
            color={palette.color}
            reduced={reduced !== false}
          />
        ))}
      </Animated.View>
    </View>
  );
}

function FloatingCard({
  children,
  index,
  clock,
  caught,
  reduced,
  color,
}: {
  children: ReactNode;
  index: number;
  clock: SharedValue<number>;
  caught: SharedValue<number>;
  reduced: boolean;
  color: string;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - caught.value,
    transform: [
      { translateX: reduced ? 0 : Math.cos(clock.value + index * 1.7) * 4 },
      {
        translateY:
          (reduced ? 0 : Math.sin(clock.value * 2 + index * 1.7) * 7) +
          caught.value * 40,
      },
      { scale: 1 - caught.value * 0.6 },
    ],
  }));
  return (
    <Animated.View
      entering={
        !reduced ? FadeInDown.delay(index * 100).duration(420) : undefined
      }
      style={[s.card, { borderColor: color }, style]}
    >
      {children}
    </Animated.View>
  );
}

function TrackingArrow({
  card,
  index,
  clock,
  bounds,
  visible,
  caught,
  color,
  reduced,
}: {
  card: LayoutRectangle;
  index: number;
  clock: SharedValue<number>;
  bounds: SharedValue<Rect>;
  visible: SharedValue<number>;
  caught: SharedValue<number>;
  color: string;
  reduced: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const dx = reduced ? 0 : Math.cos(clock.value + index * 1.7) * 4;
    const dy = reduced ? 0 : Math.sin(clock.value * 2 + index * 1.7) * 7;
    const center = {
      x: card.x + card.width / 2 + dx,
      y: card.y + card.height / 2 + dy,
    };
    const to = arrowToBox(center, bounds.value);
    const vx = to.x - center.x;
    const vy = to.y - center.y;
    const distance = Math.hypot(vx, vy);
    const edge =
      1 /
      Math.max(
        Math.abs(vx) / (card.width / 2 + 4),
        Math.abs(vy) / (card.height / 2 + 4),
        1,
      );
    const from = { x: center.x + vx * edge, y: center.y + vy * edge };
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    return {
      opacity:
        visible.value *
        (1 - caught.value) *
        (distance > 12 && edge < 1
          ? 0.65 + Math.sin(clock.value * 3) * 0.15
          : 0),
      width: length,
      left: (from.x + to.x - length) / 2,
      top: (from.y + to.y) / 2,
      transform: [{ rotate: `${Math.atan2(vy, vx)}rad` }],
    };
  });
  return (
    <Animated.View style={[s.arrow, { backgroundColor: color }, style]}>
      <View style={[s.arrowhead, { borderColor: color }]} />
    </Animated.View>
  );
}

function Spark({
  index,
  clock,
  bounds,
  caught,
  color,
  reduced,
}: {
  index: number;
  clock: SharedValue<number>;
  bounds: SharedValue<Rect>;
  caught: SharedValue<number>;
  color: string;
  reduced: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const phase = index * 2.399;
    const angle = phase + (reduced ? 0 : clock.value * (index % 2 ? 1 : -1));
    const twinkle = reduced ? 0.5 : (Math.sin(clock.value * 5 + phase) + 1) / 2;
    const burst = caught.value * 100;
    return {
      opacity: 0.15 + twinkle * 0.85,
      transform: [
        {
          translateX:
            Math.cos(angle) *
            (bounds.value.width / 2 + 14 + (index % 4) * 8 + burst),
        },
        {
          translateY:
            Math.sin(angle) *
            (bounds.value.height / 2 + 12 + (index % 3) * 7 + burst),
        },
        { scale: 0.35 + twinkle * 1.1 },
        { rotate: `${angle + clock.value}rad` },
      ],
    };
  });
  return (
    <Animated.View style={[s.spark, style]}>
      <Ionicons
        name={index % 3 === 0 ? "sparkles" : "star"}
        size={index % 3 === 0 ? 17 : 9}
        color={color}
      />
    </Animated.View>
  );
}

function Ripple({
  index,
  clock,
  bounds,
  color,
  reduced,
}: {
  index: number;
  clock: SharedValue<number>;
  bounds: SharedValue<Rect>;
  color: string;
  reduced: boolean;
}) {
  const style = useAnimatedStyle(() => {
    const progress = ((clock.value / (Math.PI * 2)) * 2 + index / 2) % 1;
    return {
      width: bounds.value.width + 24,
      height: bounds.value.height + 24,
      left: -(bounds.value.width + 24) / 2,
      top: -(bounds.value.height + 24) / 2,
      opacity: reduced ? 0 : (1 - progress) * 0.22,
      transform: [{ scale: 1 + progress * 0.35 }],
    };
  });
  return <Animated.View style={[s.ripple, { borderColor: color }, style]} />;
}
const displayFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-medium",
  web: "Avenir Next, ui-rounded, system-ui, sans-serif",
});
const s = StyleSheet.create({
  position: { ...StyleSheet.absoluteFill },
  labelSlot: { position: "absolute", maxWidth: "44%" },
  card: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: cameraColors.surface,
  },
  topLeft: { left: "5%", top: "20%" },
  topRight: { right: "5%", top: "20%" },
  bottomLeft: { left: "5%", top: "51%" },
  bottomRight: { right: "5%", top: "51%" },
  status: {
    fontFamily: displayFont,
    fontSize: 10,
    letterSpacing: 0.7,
    fontWeight: "800",
  },
  name: {
    fontFamily: displayFont,
    letterSpacing: -0.5,
    fontSize: 21,
    fontWeight: "700",
    color: cameraColors.foreground,
  },
  cuisine: { fontSize: 12, color: cameraColors.foreground },
  tier: { fontSize: 12, fontWeight: "700" },
  xp: { fontFamily: displayFont, fontSize: 17, fontWeight: "700" },
  caption: { color: cameraColors.muted, fontSize: 10 },
  arrow: { position: "absolute", height: 1 },
  arrowhead: {
    position: "absolute",
    right: 0,
    top: -3,
    width: 7,
    height: 7,
    borderTopWidth: 1.5,
    borderRightWidth: 1.5,
    transform: [{ rotate: "45deg" }],
  },
  particles: { position: "absolute" },
  spark: { position: "absolute", left: -7, top: -7 },
  ripple: { position: "absolute", borderRadius: 999, borderWidth: 1 },
});
