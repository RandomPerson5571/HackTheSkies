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
  label,
  style,
  eager = false,
}: {
  source: ImageSourcePropType | undefined;
  label: string;
  style: StyleProp<ImageStyle>;
  eager?: boolean;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const sourceKey = JSON.stringify(source);
  if (!source || failedSource === sourceKey)
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
      eager={eager}
      source={source}
      style={style}
      accessibilityLabel={label}
      resizeMode="cover"
      onError={() => setFailedSource(sourceKey)}
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
