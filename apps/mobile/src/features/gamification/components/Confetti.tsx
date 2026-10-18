import { useEffect, useMemo, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

const COLORS = ["#FF6B6B", "#FFD93D", "#6BCB77", "#4D96FF", "#9B59B6", "#FF8C42"];
const PIECES = 40;

export function Confetti({ active }: { active: boolean }) {
  const anims = useMemo(
    () =>
      Array.from({ length: PIECES }, () => ({
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        r: new Animated.Value(0),
        o: new Animated.Value(1),
      })),
    [],
  );
  const running = useRef(false);

  useEffect(() => {
    if (!active || running.current) return;
    running.current = true;
    const animations = anims.map((a) => {
      const startX = Math.random() * 300 - 150;
      const endX = startX + (Math.random() * 80 - 40);
      a.x.setValue(startX);
      a.y.setValue(-20);
      a.r.setValue(0);
      a.o.setValue(1);
      const delay = Math.random() * 200;
      return Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(a.y, { toValue: 400 + Math.random() * 100, duration: 1400, useNativeDriver: true }),
          Animated.timing(a.x, { toValue: endX, duration: 1400, useNativeDriver: true }),
          Animated.timing(a.r, { toValue: Math.random() * 6, duration: 1400, useNativeDriver: true }),
          Animated.timing(a.o, { toValue: 0, duration: 1400, delay: 600, useNativeDriver: true }),
        ]),
      ]);
    });
    Animated.parallel(animations).start(() => {
      running.current = false;
    });
  }, [active, anims]);

  if (!active) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            width: 8,
            height: 14,
            borderRadius: 2,
            backgroundColor: COLORS[i % COLORS.length],
            opacity: a.o,
            transform: [
              { translateX: a.x },
              { translateY: a.y },
              { rotate: a.r.interpolate({ inputRange: [0, 6], outputRange: ["0deg", "360deg"] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
