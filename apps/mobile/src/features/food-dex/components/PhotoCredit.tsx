import { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import type { Dish } from "../models/foodDex";
import { colors } from "../../../theme/index";

export function PhotoCredit({ dish }: { dish: Dish | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  if (!dish?.image) return null;
  const image = dish.image;
  async function open(url: string) {
    try {
      await Linking.openURL(url);
      setError("");
    } catch {
      setError("Couldn’t open the credit link.");
    }
  }
  return (
    <View style={s.credit}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Photo credits for ${dish.name}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={({ pressed }) => [s.toggle, pressed && s.pressed]}
      >
        <Text style={s.text}>
          Photo:{" "}
          {image.source === "wikimedia"
            ? "Wikimedia Commons"
            : image.source === "pexels"
              ? "Pexels"
              : "TheMealDB"}{" "}
          · {expanded ? "Hide credits" : "Credits"}
        </Text>
      </Pressable>
      {expanded && (
        <View>
          <Text style={s.text}>{image.attribution}</Text>
          <View style={s.links}>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Photo source for ${dish.name}`}
              onPress={() => void open(image.sourceUrl)}
              style={s.toggle}
            >
              <Text style={s.link}>Photo source</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Photo license for ${dish.name}`}
              onPress={() => void open(image.licenseUrl)}
              style={s.toggle}
            >
              <Text style={s.link}>{image.licenseName || "Source terms"}</Text>
            </Pressable>
          </View>
          {error ? (
            <Text accessibilityRole="alert" style={s.text}>
              {error}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  credit: { paddingHorizontal: 14 },
  text: { fontSize: 11, lineHeight: 16, color: colors.muted, flexShrink: 1 },
  toggle: { minHeight: 48, justifyContent: "center", paddingVertical: 8 },
  pressed: { opacity: 0.6 },
  links: { flexDirection: "row", flexWrap: "wrap", columnGap: 18 },
  link: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.accent,
    textDecorationLine: "underline",
  },
});
