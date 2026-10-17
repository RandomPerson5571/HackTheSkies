import { Image, type ImageStyle, type StyleProp } from "react-native";
import type { Place } from "../data/places";
import type { Recommendation } from "../models/recommendations";

// Gate mounting the image itself so hidden photos make no network/decode requests.
export function RestaurantPhoto({
  place,
  recommendation,
  style,
}: {
  place: Place;
  recommendation: Recommendation | undefined;
  style: StyleProp<ImageStyle>;
}) {
  if (!recommendation?.suggested) return null;
  return <Image source={{ uri: place.image }} style={style} />;
}
