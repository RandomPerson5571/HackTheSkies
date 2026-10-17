import { useState } from "react";
import {
  Image,
  View,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ImageStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../../theme/index";

export function CatalogPhoto({
  source,
  label,
  style,
}: {
  source: ImageSourcePropType | undefined;
  label: string;
  style: StyleProp<ImageStyle>;
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
    <Image
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
