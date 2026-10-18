import { useState } from "react";
import { Text, View, type ImageStyle, type StyleProp } from "react-native";
import { LazyImage } from "../../../components/images/LazyImage";
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
  if (failedUrl === place.image)
    return (
      <View style={style}>
        <Text>Photo unavailable</Text>
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
