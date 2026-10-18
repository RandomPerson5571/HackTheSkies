import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme";

// "Load more" row paired with usePagedList. Hidden while nothing remains.
export function PagedListFooter({
  noun,
  hasMore,
  shown,
  total,
  remaining,
  onLoadMore,
}: {
  noun: string;
  hasMore: boolean;
  shown: number;
  total: number;
  remaining: number;
  onLoadMore: () => void;
}) {
  if (!total || !hasMore) return null;
  return (
    <View style={s.wrap}>
      <View style={s.line} />
      <Text style={s.copy}>
        Showing {shown} of {total} {noun}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Load ${remaining} more ${noun}`}
        onPress={onLoadMore}
        style={({ pressed }) => [s.button, pressed && s.dim]}
      >
        <Ionicons accessible={false} name="chevron-down" size={15} />
        <Text accessible={false} style={s.buttonText}>
          Load {remaining} more
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: 10, paddingVertical: 6 },
  line: { alignSelf: "stretch", height: 1, backgroundColor: colors.border },
  copy: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    color: colors.muted,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.tint,
  },
  buttonText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.accent,
  },
  dim: { opacity: 0.55 },
});
