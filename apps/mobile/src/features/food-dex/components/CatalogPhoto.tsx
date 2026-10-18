import { useState } from "react";
import {
  View,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/index";
import { LazyImage } from "../../../components/images/LazyImage";

export function CatalogPhoto({
  source,
  fallbackSource,
  label,
  style,
  eager = false,
}: {
  source: ImageSourcePropType | undefined;
  fallbackSource?: ImageSourcePropType;
  label: string;
  style: StyleProp<ImageStyle>;
  eager?: boolean;
}) {
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const candidates = [source, fallbackSource];
  const activeSource = candidates.find(
    (candidate) => candidate && !failedSources.includes(JSON.stringify(candidate)),
  );
  const sourceKey = JSON.stringify(activeSource);
  if (!activeSource)
    return (
      <View
        style={[style, s.placeholder]}
        accessible
        accessibilityLabel={label}
      >
        <Ionicons
          name="restaurant-outline"
          size={26}
          color={colors.accent}
          accessible={false}
        />
      </View>
    );
  return (
    <LazyImage
      key={sourceKey}
      eager={eager}
      source={activeSource}
      style={style}
      accessibilityLabel={label}
      resizeMode="cover"
      onError={() =>
        setFailedSources((previous) =>
          previous.includes(sourceKey) ? previous : [...previous, sourceKey],
        )
      }
    />
  );
}

const s = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
});
