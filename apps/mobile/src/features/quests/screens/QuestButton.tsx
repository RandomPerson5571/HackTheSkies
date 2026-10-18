import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { Text, StyleSheet } from "react-native";
import { questColors as c } from "../../../theme";

export function QuestButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[styles.buttonText, secondary && { color: c.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    backgroundColor: c.navy,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: c.lime },
  buttonText: {
    color: c.paper,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
});
