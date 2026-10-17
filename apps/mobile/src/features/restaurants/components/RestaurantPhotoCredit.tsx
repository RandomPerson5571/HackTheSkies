import { useState } from "react";
import { Linking, Text, View } from "react-native";
import type { Place } from "../data/places";
import { colors } from "../../../theme/index";

export function RestaurantPhotoCredit({ place }: { place: Place }) {
  const [error, setError] = useState(false);
  const photo = place.photo;
  if (!photo) return null;
  async function open(url: string) {
    try {
      await Linking.openURL(url);
      setError(false);
    } catch {
      setError(true);
    }
  }
  return (
    <View>
      {photo.kind === "illustration" && (
        <Text style={{ fontSize: 11, lineHeight: 16, color: colors.muted }}>
          Food illustration: {photo.dishName} · Not photographed at this restaurant
        </Text>
      )}
      <Text style={{ fontSize: 11, lineHeight: 16, color: colors.muted }}>
        Photo: {photo.photographer || "Source website"}{photo.provider === "source-website" ? "" : ` · ${photo.provider || "Wikimedia Commons"}`}{photo.capturedAt ? ` · ${photo.capturedAt.slice(0, 4)}` : ""}{"\n"}
        <Text accessibilityRole="link" onPress={(event) => { event.stopPropagation(); void open(photo.sourceUrl); }} style={{ textDecorationLine: "underline" }}>Source</Text>
        {" · "}
        {photo.licenseUrl ? <Text accessibilityRole="link" onPress={(event) => { event.stopPropagation(); void open(photo.licenseUrl!); }} style={{ textDecorationLine: "underline" }}>{photo.licenseName}</Text> : "Rights not specified"}
        {" · Cropped to fit"}
      </Text>
      {error && <Text accessibilityRole="alert">Couldn’t open the photo credit link.</Text>}
    </View>
  );
}
