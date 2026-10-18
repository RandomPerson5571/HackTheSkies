import { useEffect, useMemo, useRef } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { atlasCuisines, cuisineAnchors } from "../models/discovery";
import type { Cuisine } from "../models/foodDex";
import {
  gridDots,
  landDots,
  skyStars,
  TILT,
  type SphereDot,
} from "../data/globeLand";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { discoveryColors as c } from "../../../theme";

const DEG = Math.PI / 180;
// Screen radius sits slightly inside the clipped disc edge.
const INSET = 3;
const DRAG_SENSITIVITY = 0.55;

export type RouteDotSpec = {
  key: string;
  lon: number;
  lat: number;
  // Reveal fraction 0..1 used to stagger this dot's entrance.
  order: number;
};

export type AtlasGlobeProps = {
  size: number;
  rotation: SharedValue<number>;
  reveal: SharedValue<number>;
  litMask: SharedValue<number>;
  routeSpecs: RouteDotSpec[];
  routesLive: boolean;
  explored: Set<Cuisine>;
  selected: Cuisine;
  reduced: boolean;
  onSelectCuisine: (cuisine: Cuisine) => void;
  // Stops any rotation animation and returns the current rotation (degrees).
  onDragStart: () => number;
  onDragMove: (rotation: number) => void;
  onDragRelease: (velocityPerSecond: number) => void;
};

/** Orthographic projection of one dot, given its precomputed unit-sphere terms. */
function dotPose(
  latSin: number,
  latCos: number,
  lonSin: number,
  lonCos: number,
  sinRot: number,
  cosRot: number,
) {
  const sinLon = lonSin * cosRot - lonCos * sinRot;
  const cosLon = lonCos * cosRot + lonSin * sinRot;
  const x = latCos * sinLon;
  const z = latCos * cosLon;
  return {
    x,
    depth: latSin * TILT.sin + z * TILT.cos,
    y: latSin * TILT.cos - z * TILT.sin,
  };
}

function LandDot({
  dot,
  size,
  litMask,
  rotation,
}: {
  dot: SphereDot;
  size: number;
  litMask: SharedValue<number>;
  rotation: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const radius = size / 2 - INSET;
    const pose = dotPose(
      dot.latSin,
      dot.latCos,
      dot.lonSin,
      dot.lonCos,
      Math.sin(rotation.value * DEG),
      Math.cos(rotation.value * DEG),
    );
    const lit = (dot.region & litMask.value) !== 0;
    return {
      transform: [
        { translateX: radius + radius * pose.x + dot.jx - 2 },
        { translateY: radius - radius * pose.y + dot.jy - 2 },
        { scale: lit ? 0.9 + 0.35 * pose.depth : 0.62 + 0.38 * pose.depth },
      ],
      opacity:
        pose.depth > 0.015
          ? lit
            ? 0.55 + 0.45 * pose.depth
            : 0.3 + 0.58 * pose.depth
          : 0,
      backgroundColor: lit ? c.glow : c.land,
    };
  });
  return <Animated.View style={[s.landDot, style]} />;
}

function GridDot({
  dot,
  size,
  rotation,
}: {
  dot: SphereDot;
  size: number;
  rotation: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const radius = size / 2 - INSET;
    const pose = dotPose(
      dot.latSin,
      dot.latCos,
      dot.lonSin,
      dot.lonCos,
      Math.sin(rotation.value * DEG),
      Math.cos(rotation.value * DEG),
    );
    return {
      transform: [
        { translateX: radius + radius * pose.x + dot.jx - 1 },
        { translateY: radius - radius * pose.y + dot.jy - 1 },
        { scale: 0.7 + 0.4 * pose.depth },
      ],
      opacity: pose.depth > 0.015 ? 0.2 + 0.38 * pose.depth : 0,
    };
  });
  return <Animated.View style={[s.gridDot, style]} />;
}

function RouteDot({
  spec,
  size,
  rotation,
  reveal,
}: {
  spec: RouteDotSpec;
  size: number;
  rotation: SharedValue<number>;
  reveal: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const radius = size / 2 - INSET;
    const pose = dotPose(
      Math.sin(spec.lat * DEG),
      Math.cos(spec.lat * DEG),
      Math.sin(spec.lon * DEG),
      Math.cos(spec.lon * DEG),
      Math.sin(rotation.value * DEG),
      Math.cos(rotation.value * DEG),
    );
    const pop = interpolate(
      reveal.value,
      [Math.max(0, spec.order - 0.28), Math.min(1, spec.order + 0.34)],
      [0, 0.9],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: radius + radius * pose.x - 2.5 },
        { translateY: radius - radius * pose.y - 2.5 },
        { scale: 0.75 + 0.45 * pose.depth },
      ],
      opacity: pop * (pose.depth > 0.015 ? 0.4 + 0.6 * pose.depth : 0),
    };
  });
  return <Animated.View style={[s.routeDot, style]} />;
}

function CuisinePin({
  cuisine,
  lon,
  lat,
  bit,
  size,
  rotation,
  lit,
  selected,
  reduced,
  onSelectCuisine,
}: {
  cuisine: Cuisine;
  lon: number;
  lat: number;
  bit: number;
  size: number;
  rotation: SharedValue<number>;
  lit: boolean;
  selected: boolean;
  reduced: boolean;
  onSelectCuisine: (cuisine: Cuisine) => void;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (!lit || reduced) {
      pulse.value = 0;
      return;
    }
    pulse.value = withDelay(
      240 + (bit % 8) * 180,
      withRepeat(
        withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(pulse);
  }, [lit, reduced, pulse, bit]);

  const style = useAnimatedStyle(() => {
    const radius = size / 2 - INSET;
    const pose = dotPose(
      Math.sin(lat * DEG),
      Math.cos(lat * DEG),
      Math.sin(lon * DEG),
      Math.cos(lon * DEG),
      Math.sin(rotation.value * DEG),
      Math.cos(rotation.value * DEG),
    );
    return {
      transform: [
        { translateX: radius + radius * pose.x - 19 },
        { translateY: radius - radius * pose.y - 19 },
      ],
      opacity: pose.depth > 0.04 ? (lit ? 1 : 0.78) : 0,
    };
  });
  const beacon = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 2.2 }],
    opacity: (1 - pulse.value) * (lit ? 0.55 : 0),
  }));
  return (
    <Animated.View style={[s.pinHit, style]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${cuisine}, ${lit ? "discovered" : "undiscovered"}. Set as the atlas region.`}
        accessibilityState={{ selected }}
        onPress={() => onSelectCuisine(cuisine)}
        style={({ pressed }) => [s.pinFace, pressed && s.pinPressed]}
      >
        {selected && <View style={s.pinSparkle} />}
        {lit && <View style={s.pinHalo} />}
        {(selected || lit) && <View style={s.pinRim} />}
        <Animated.View style={[s.pinBeacon, beacon]} />
        <View
          style={[
            s.pinCore,
            lit && s.litCore,
            selected && s.selectedCore,
            !lit && !selected && s.dimCore,
          ]}
        />
      </Pressable>
    </Animated.View>
  );
}

function TwinkleStar({
  size,
  alpha,
  delay,
}: {
  size: number;
  alpha: number;
  delay: number;
}) {
  const twinkle = useSharedValue(0.4);
  useEffect(() => {
    const duration = 1500 + (delay % 900);
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.4, { duration, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
    return () => cancelAnimation(twinkle);
  }, [delay, twinkle]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(twinkle.value, [0, 1], [alpha * 0.45, alpha]),
  }));
  return (
    <Animated.View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: c.light,
        },
        style,
      ]}
    />
  );
}

export function StarField({ reduced }: { reduced: boolean }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {skyStars.map((star, index) => (
        <View
          key={`star-${index}`}
          style={{ position: "absolute", left: `${star.x}%`, top: `${star.y}%` }}
        >
          {star.twinkle && !reduced ? (
            <TwinkleStar size={star.size} alpha={star.alpha} delay={star.delay} />
          ) : (
            <View
              style={{
                width: star.size,
                height: star.size,
                borderRadius: star.size / 2,
                backgroundColor: c.light,
                opacity: star.alpha,
              }}
            />
          )}
        </View>
      ))}
    </View>
  );
}

function OrbitRibbon({ size }: { size: number }) {
  const spin = useSharedValue(0);
  const orbit = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));
  useEffect(() => {
    spin.value = withRepeat(
      withTiming(360, { duration: 26000, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(spin);
  }, [spin]);
  return (
    <View pointerEvents="none" style={[s.orbit, { width: size, height: size }]}>
      <Animated.View style={[StyleSheet.absoluteFill, s.orbitSpin, orbit]}>
        <View style={s.orbitDot} />
      </Animated.View>
    </View>
  );
}

export function AtlasGlobe({
  size,
  rotation,
  reveal,
  litMask,
  routeSpecs,
  routesLive,
  explored,
  selected,
  reduced,
  onSelectCuisine,
  onDragStart,
  onDragMove,
  onDragRelease,
}: AtlasGlobeProps) {
  const dragAnchor = useRef(0);
  const [pan] = useMemo(() => {
    // Pan handlers are created once; gesture callbacks run outside render, so
    // reading/writing the gesture ref and prop callbacks here is intended.
    // eslint-disable-next-line react-hooks/refs
    const handlers = PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 6 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderGrant: () => {
        dragAnchor.current = onDragStart();
      },
      onPanResponderMove: (_, gesture) => {
        onDragMove(dragAnchor.current - gesture.dx * DRAG_SENSITIVITY);
      },
      onPanResponderRelease: (_, gesture) => {
        onDragRelease(-gesture.vx * 1000 * DRAG_SENSITIVITY);
      },
      onPanResponderTerminate: () => {
        onDragRelease(0);
      },
    });
    return [handlers];
    // Gesture wiring is stable for the lifetime of the globe; callbacks only
    // touch refs and shared values, so an empty dependency list is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stack = size + 40;
  const enter = useSharedValue(0);
  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      return;
    }
    enter.value = withTiming(1, {
      duration: 760,
      easing: Easing.out(Easing.cubic),
    });
    return () => cancelAnimation(enter);
  }, [reduced, enter]);

  const enterStyle = useAnimatedStyle(() => ({
    opacity: interpolate(enter.value, [0, 0.55], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(enter.value, [0, 1], [0.92, 1]) }],
  }));

  return (
    <View style={[s.stack, { width: stack, height: stack }]}>
      {reduced ? null : <OrbitRibbon size={stack} />}
      <View
        pointerEvents="none"
        style={[
          s.atmoFloor,
          { width: size + 30, height: size + 30, borderRadius: (size + 30) / 2 },
        ]}
      />
      <Animated.View
        style={[s.discWrap, { width: size, height: size }, enterStyle]}
      >
        <View
          {...pan.panHandlers}
          accessibilityLabel="Illustrated culinary globe. Drag to spin the world; buttons below rotate east and west."
          style={[
            s.disc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
            },
          ]}
        >
          <View pointerEvents="none" style={s.oceanTint} />
          {gridDots.map((dot) => (
            <GridDot
              key={`g${dot.key}`}
              dot={dot}
              size={size}
              rotation={rotation}
            />
          ))}
          {landDots.map((dot) => (
            <LandDot
              key={`l${dot.key}`}
              dot={dot}
              size={size}
              litMask={litMask}
              rotation={rotation}
            />
          ))}
          {routesLive
            ? routeSpecs.map((spec) => (
                <RouteDot
                  key={`r${spec.key}`}
                  spec={spec}
                  size={size}
                  rotation={rotation}
                  reveal={reveal}
                />
              ))
            : null}
          <View pointerEvents="none" style={s.sheen} />
          <View pointerEvents="none" style={s.rimShade} />
          {atlasCuisines.map((cuisine, index) => {
            const anchor = cuisineAnchors[cuisine];
            if (!anchor) return null;
            return (
              <CuisinePin
                key={cuisine}
                cuisine={cuisine}
                lon={anchor[0]}
                lat={anchor[1]}
                bit={1 << index}
                size={size}
                rotation={rotation}
                lit={explored.has(cuisine)}
                selected={cuisine === selected}
                reduced={reduced}
                onSelectCuisine={onSelectCuisine}
              />
            );
          })}
        </View>
      </Animated.View>
      <View
        pointerEvents="none"
        style={[
          s.rimGlow,
          {
            width: size + 12,
            height: size + 12,
            borderRadius: (size + 12) / 2,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          s.atmo,
          {
            width: size + 24,
            height: size + 24,
            borderRadius: (size + 24) / 2,
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  stack: { alignItems: "center", justifyContent: "center" },
  discWrap: { alignItems: "center", justifyContent: "center" },
  disc: {
    backgroundColor: c.ocean,
    borderWidth: 1,
    borderColor: c.line,
    overflow: "hidden",
  },
  oceanTint: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#2A4E7826",
  },
  sheen: {
    position: "absolute",
    top: 12,
    left: 20,
    width: 76,
    height: 30,
    borderRadius: 40,
    backgroundColor: "#FFF6D80F",
    transform: [{ rotate: "-18deg" }, { skewX: "8deg" }],
  },
  rimShade: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderColor: "#04080F3D",
    borderWidth: 9,
  },
  atmoFloor: {
    position: "absolute",
    backgroundColor: "rgba(114, 146, 157, 0.10)",
  },
  rimGlow: {
    position: "absolute",
    borderColor: "#72929D2E",
    borderWidth: 1.5,
  },
  atmo: {
    position: "absolute",
    borderColor: "#72929D1A",
    borderWidth: 1,
    shadowColor: "#72929D",
    shadowOpacity: 0.17,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  orbit: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#3D526F59",
    borderWidth: 1,
    borderRadius: 999,
  },
  orbitSpin: {},
  orbitDot: {
    position: "absolute",
    top: -2.5,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.gold,
    shadowColor: c.gold,
    shadowOpacity: 0.9,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  landDot: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: c.land,
  },
  gridDot: {
    position: "absolute",
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: c.line,
  },
  routeDot: {
    position: "absolute",
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.gold,
  },
  pinHit: {
    position: "absolute",
    width: 38,
    height: 38,
  },
  pinFace: { flex: 1, alignItems: "center", justifyContent: "center" },
  pinPressed: { opacity: 0.55 },
  pinHalo: {
    position: "absolute",
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#EAF3B216",
  },
  pinRim: {
    position: "absolute",
    width: 17,
    height: 17,
    borderRadius: 9,
    borderColor: "#EAF3B259",
    borderWidth: 1,
  },
  pinBeacon: {
    position: "absolute",
    width: 15,
    height: 15,
    borderRadius: 8,
    borderColor: "#EAF3B266",
    borderWidth: 1.5,
  },
  pinSparkle: {
    position: "absolute",
    width: 23,
    height: 23,
    borderRadius: 12,
    borderColor: c.gold,
    borderWidth: 1.5,
    backgroundColor: "#F4DB9126",
  },
  pinCore: {
    width: 5.5,
    height: 5.5,
    borderRadius: 3,
    backgroundColor: c.muted,
  },
  litCore: {
    backgroundColor: c.glow,
    width: 6.5,
    height: 6.5,
    borderRadius: 3.5,
  },
  selectedCore: {
    backgroundColor: c.gold,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dimCore: { opacity: 0.8 },
});
