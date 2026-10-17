import { useEffect, useRef, useState } from "react";
import {
  Image,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { LazyImageProps } from "./LazyImage";

const pending = new Map<Element, () => void>();
let observer: IntersectionObserver | undefined;

function observe(element: Element, load: () => void) {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const start = pending.get(entry.target);
          pending.delete(entry.target);
          observer?.unobserve(entry.target);
          start?.();
        }
      }
    },
    { rootMargin: "300px" },
  );
  pending.set(element, load);
  observer.observe(element);
  return () => {
    pending.delete(element);
    observer?.unobserve(element);
    if (pending.size === 0) {
      observer?.disconnect();
      observer = undefined;
    }
  };
}

export function LazyImage({ eager = false, style, ...props }: LazyImageProps) {
  const ref = useRef<View>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (eager || visible) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    // React Native Web exposes the underlying DOM node through View's ref.
    const element = ref.current as unknown as Element | null;
    if (element) return observe(element, () => setVisible(true));
  }, [eager, visible]);

  return (
    <View ref={ref} style={[style as StyleProp<ViewStyle>, styles.container]}>
      {(eager || visible) && (
        <Image {...props} style={[StyleSheet.absoluteFill, styles.image]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
  image: { width: "100%", height: "100%" },
});
