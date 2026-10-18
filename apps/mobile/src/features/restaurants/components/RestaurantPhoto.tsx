import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, View, type ImageStyle, type StyleProp } from "react-native";
import { LazyImage } from "../../../components/images/LazyImage";
import { colors } from "../../../theme";
import type { Place } from "../data/places";
import type { Recommendation } from "../models/recommendations";

// Gate mounting the image itself so hidden photos make no network/decode requests.
export function RestaurantPhoto({
  place,
  recommendation,
  style,
  showAll = false,
  eager = false,
}: {
  showAll?: boolean;
  eager?: boolean;
  place: Place;
  recommendation: Recommendation | undefined;
  style: StyleProp<ImageStyle>;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!showAll && !recommendation?.suggested) return null;
  if (!place.image || failedUrl === place.image)
    return (
      <View
        accessibilityRole="image"
        accessibilityLabel={`${place.name} restaurant illustration`}
        style={[style, styles.placeholder]}
      >
        <View style={styles.orbit} accessible={false} />
        <View style={styles.plate} accessible={false}>
          <Ionicons
            name="restaurant-outline"
            size={28}
            color={colors.accent}
            accessible={false}
          />
        </View>
      </View>
    );
  return (
    <LazyImage
      eager={eager}
      onError={() => setFailedUrl(place.image)}
      source={{ uri: place.image }}
      accessibilityLabel={place.name}
      style={style}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
    borderColor: colors.accent,
    opacity: 0.12,
    transform: [{ translateX: 36 }, { translateY: -28 }],
  },
  plate: {
    width: 60,
    height: 60,
    maxWidth: "90%",
    maxHeight: "90%",
    borderRadius: 30,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
