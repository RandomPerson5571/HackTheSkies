import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
} from "react-native";
import {
  previewBox,
  type FoodBox,
  type FrameSize,
} from "../models/foodDetection";

export function FoodBoundingBox({
  box,
  frame,
  preview,
  label,
  selected,
  mirrored = false,
  onSelect,
}: {
  box: FoodBox;
  frame: FrameSize;
  preview: FrameSize;
  label: string;
  selected: boolean;
  mirrored?: boolean;
  onSelect?: () => void;
}) {
  const position = previewBox(box, frame, preview, mirrored);
  const [geometry] = useState(() => ({
    left: new Animated.Value(position?.x ?? 0),
    top: new Animated.Value(position?.y ?? 0),
    width: new Animated.Value(position?.width ?? 0),
    height: new Animated.Value(position?.height ?? 0),
  }));
  const [opacity] = useState(() => new Animated.Value(1));
  const [reducedMotion, setReducedMotion] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReducedMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  const x = position?.x ?? 0,
    y = position?.y ?? 0,
    width = position?.width ?? 0,
    height = position?.height ?? 0;
  useEffect(() => {
    const animation = Animated.parallel(
      Object.entries({ left: x, top: y, width, height }).map(([key, toValue]) =>
        Animated.timing(geometry[key as keyof typeof geometry], {
          toValue,
          duration: reducedMotion ? 0 : 160,
          useNativeDriver: false,
        }),
      ),
    );
    animation.start();
    return () => animation.stop();
  }, [x, y, width, height, geometry, reducedMotion]);
  useEffect(() => {
    if (reducedMotion || !selected) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.65,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, reducedMotion, selected]);
  if (!position) return null;
  return (
    <Animated.View
      style={[
        s.box,
        geometry,
        { opacity, borderColor: selected ? "#A7F3B1" : "#FFFDF5" },
      ]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        onPress={onSelect}
        style={s.target}
      >
        <Text numberOfLines={2} style={s.label}>
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  box: { position: "absolute", borderWidth: 2, borderRadius: 14 },
  target: { flex: 1, minHeight: 44, minWidth: 44, alignItems: "flex-start" },
  label: {
    backgroundColor: "#164B31",
    color: "#FFFDF5",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderBottomRightRadius: 10,
    borderTopLeftRadius: 10,
    fontSize: 12,
    fontWeight: "600",
    maxWidth: "100%",
  },
});
