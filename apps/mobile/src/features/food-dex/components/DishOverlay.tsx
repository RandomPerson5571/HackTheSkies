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
// Labels hug the tracking box corners; this is the gap between the two edges.
const GAP = 14;

// Anchor one label card at a corner of the tracked box, clamped inside the
// preview so food near the frame edge keeps its labels on screen.
function cardAnchor(
  corner: number,
  box: Rect,
  card: { width: number; height: number },
  container: { width: number; height: number },
) {
  "worklet";
  const x = corner % 2 ? box.x + box.width : box.x;
  const y = corner < 2 ? box.y : box.y + box.height;
  let left = corner % 2 ? x + GAP : x - card.width - GAP;
  let top = corner < 2 ? y - card.height - GAP : y + GAP;
  if (container.width - card.width > 16)
    left = Math.max(8, Math.min(left, container.width - card.width - 8));
  if (container.height - card.height > 16)
    top = Math.max(8, Math.min(top, container.height - card.height - 8));
  return { left, top };
}

export function DishOverlay({
  recognition,
  collected,
  catching,
  scanning = false,
  analyzing = false,
  anchor,
  preview,
}: {
  recognition: FoodRecognition | null;
  scanning?: boolean;
  analyzing?: boolean;
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
  // A Groq fallback box is an estimate, not a tracked object: it renders with
  // its own accent and clearly labels itself as approximate.
  const hasLocation = !!anchor?.visible;
  const estimated = hasLocation && anchor?.source === "groq";
  const accent = estimated ? "#F4DB91" : palette.color;
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
    const w = preview?.width || size.width;
    const h = preview?.height || size.height;
    if (anchor && !anchor.visible) {
      // Unlocalized food gets a discovery card, never an invented object box.
      bounds.value = { x: w * 0.5, y: h * 0.35, width: 0, height: 0 };
      visible.value = 1;
      return;
    }
    const b = anchor ?? {
      x: 0.28,
      y: 0.3,
      width: 0.44,
      height: 0.25,
      visible: true,
    };
    bounds.value = withTiming(
      { x: b.x * w, y: b.y * h, width: b.width * w, height: b.height * h },
      { duration: reduced === false ? 170 : 0 },
    );
    visible.value = withTiming(1, { duration: 220 });
  }, [anchor, bounds, preview, reduced, size, visible]);
  useEffect(() => {
    caught.value = withTiming(catching ? 1 : 0, {
      duration: reduced ? 0 : 650,
    });
  }, [catching, caught, reduced]);
  const labels = [
    {
      id: "dish",
      content: (
        <>
          <Text style={s.name}>
            {recognition?.name ?? "Finding your dish…"}
          </Text>
          <Text style={s.cuisine}>
            {recognition
              ? `${recognition.cuisine} cuisine${!hasLocation ? " · Tap food to place label" : ""}`
              : analyzing
                ? "Matching your photo"
                : "Keep your dish in view"}
          </Text>
        </>
      ),
    },
    {
      id: "status",
      content: (
        <>
          <Ionicons
            name={collected ? "checkmark-circle" : "sparkles"}
            size={18}
            color={accent}
            accessible={false}
          />
          <Text style={[s.status, { color: accent }]}>
            {estimated
              ? "ESTIMATED · GROQ"
              : analyzing
                ? "ANALYZING"
                : scanning
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
      content: (
        <>
          <Text style={s.caption}>RARITY</Text>
          <Text style={[s.tier, { color: palette.color }]}>
            {scanning || analyzing
              ? "Identifying…"
              : `${tier} · ${"★".repeat(palette.stars)}`}
          </Text>
        </>
      ),
    },
    {
      id: "xp",
      content: (
        <>
          <Text style={[s.xp, { color: palette.color }]}>
            {analyzing
              ? "Checking your dex"
              : scanning
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
      {estimated && <EstimatedBox bounds={bounds} />}
      {labels
        .filter(({ id }) => hasLocation || id === "dish")
        .map(({ id, content }, index) => (
          <View
            key={id}
            style={s.labelSlot}
            onLayout={({ nativeEvent: { layout } }) =>
              setCards((old) => ({ ...old, [id]: layout }))
            }
          >
            <FloatingCard
              index={index}
              card={cards[id]}
              container={size}
              clock={clock}
              caught={caught}
              bounds={bounds}
              visible={visible}
              reduced={reduced !== false}
              estimated={estimated}
              color={accent}
            >
              {content}
            </FloatingCard>
          </View>
        ))}
      {hasLocation &&
        Object.entries(cards).map(([id, card]) => (
          <TrackingArrow
            key={id}
            card={card}
            index={["dish", "status", "rarity", "xp"].indexOf(id)}
            container={size}
            clock={clock}
            caught={caught}
            bounds={bounds}
            visible={visible}
            color={accent}
          />
        ))}
    </View>
  );
}

function EstimatedBox({ bounds }: { bounds: SharedValue<Rect> }) {
  const style = useAnimatedStyle(() => ({
    opacity: bounds.value.width > 0 && bounds.value.height > 0 ? 1 : 0,
    left: bounds.value.x,
    top: bounds.value.y,
    width: bounds.value.width,
    height: bounds.value.height,
  }));
  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: "#F4DB91",
          borderRadius: 16,
        },
        style,
      ]}
    />
  );
}

function FloatingCard({
  children,
  index,
  card,
  container,
  clock,
  caught,
  bounds,
  visible,
  reduced,
  estimated,
  color,
}: {
  children: ReactNode;
  index: number;
  card?: LayoutRectangle;
  container: { width: number; height: number };
  clock: SharedValue<number>;
  caught: SharedValue<number>;
  bounds: SharedValue<Rect>;
  visible: SharedValue<number>;
  reduced: boolean;
  estimated: boolean;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const size = card ?? { width: 0, height: 0 };
    const anchor = cardAnchor(index, bounds.value, size, container);
    return {
      // Once acquired, labels remain at the last valid position through misses.
      opacity: visible.value * (1 - caught.value),
      left: anchor.left,
      top: anchor.top,
      transform: [
        { translateX: reduced ? 0 : Math.cos(clock.value + index * 1.7) * 4 },
        {
          translateY:
            (reduced ? 0 : Math.sin(clock.value * 2 + index * 1.7) * 7) +
            caught.value * 40,
        },
        { scale: 1 - caught.value * 0.6 },
      ],
    };
  });
  return (
    <Animated.View
      entering={
        !reduced ? FadeInDown.delay(index * 100).duration(420) : undefined
      }
      style={[
        s.card,
        { borderColor: color, borderStyle: estimated ? "dashed" : "solid" },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

function TrackingArrow({
  card,
  index,
  container,
  clock,
  bounds,
  visible,
  caught,
  color,
}: {
  card: LayoutRectangle;
  index: number;
  container: { width: number; height: number };
  clock: SharedValue<number>;
  bounds: SharedValue<Rect>;
  visible: SharedValue<number>;
  caught: SharedValue<number>;
  color: string;
}) {
  const style = useAnimatedStyle(() => {
    const anchor = cardAnchor(index, bounds.value, card, container);
    const center = {
      x: anchor.left + card.width / 2,
      y: anchor.top + card.height / 2,
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
const displayFont = Platform.select({
  ios: "Avenir Next",
  android: "sans-serif-medium",
  web: "Avenir Next, ui-rounded, system-ui, sans-serif",
});
const s = StyleSheet.create({
  position: { ...StyleSheet.absoluteFill },
  labelSlot: {
    position: "absolute",
    left: 0,
    top: 0,
    maxWidth: "44%",
  },
  card: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 5,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: cameraColors.surface,
  },
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
});
