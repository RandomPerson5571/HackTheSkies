import { useState } from "react";
import { frames, trophies } from "./rewardSources";
import { Image, StyleSheet, Text, View } from "react-native";
import type { RankId, avatarPalettes } from "../models/customization";

// Labels live on the surrounding controls/cards so illustrations aren't read twice.
export function TrophyArt({
  id,
  size = 80,
  locked = false,
}: {
  id: keyof typeof trophies;
  size?: number;
  locked?: boolean;
}) {
  return (
    <Image
      source={trophies[id]}
      resizeMode="contain"
      accessible={false}
      style={{ width: size, height: size, opacity: locked ? 0.4 : 1 }}
    />
  );
}

export function DecoratedAvatar({
  name,
  frame,
  palette,
  imageUri,
  size = 104,
}: {
  name: string;
  frame: RankId | null;
  palette: (typeof avatarPalettes)[number];
  imageUri?: string;
  size?: number;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size * 0.64,
          height: size * 0.64,
          borderRadius: size,
          backgroundColor: palette.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageUri && imageUri !== failedImageUri ? (
          <Image
            source={{ uri: imageUri }}
            onError={() => setFailedImageUri(imageUri)}
            resizeMode="cover"
            accessible={false}
            style={{
              width: size * 0.64,
              height: size * 0.64,
              borderRadius: size,
            }}
          />
        ) : (
          <Text
            style={{
              color: palette.foreground,
              fontSize: size * 0.29,
              fontWeight: "800",
            }}
          >
            {name.trim().charAt(0).toUpperCase() || "F"}
          </Text>
        )}
      </View>
      {frame && (
        <Image
          source={frames[frame]}
          accessible={false}
          resizeMode="contain"
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
