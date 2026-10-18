import { useEffect, useRef, useState } from "react";
import { apiEndpoint } from "../../../lib/api";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../theme";
import { type Place } from "../data/places";

import { useBackend } from "../../../lib/BackendProvider";

type Result = {
  message: string;
  recommendations: { id: string; reason: string }[];
};
const starters = [
  "A cozy date-night spot",
  "I’m craving Vietnamese food",
  "Help me find something new",
];

export function FoodRecommender({
  visible,
  diet,
  onClose,
  onSelect,
}: {
  visible: boolean;
  diet: string;
  onClose: () => void;
  onSelect: (place: Place) => void;
}) {
  const { places } = useBackend();
  const insets = useSafeAreaInsets();
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      request.current?.abort();
      request.current = null;
    },
    [],
  );

  async function recommend() {
    if (!prompt.trim() || loading) return;
    const endpoint = apiEndpoint(
      "/api/food-recommendations",
      process.env.EXPO_PUBLIC_FOOD_RECOMMENDATIONS_URL,
    );
    if (!endpoint) {
      setError(
        "The food recommender isn’t connected yet. Please try again later.",
      );
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError("");
    setResult(null);
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), diet }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Couldn’t get suggestions. Please try again.",
        );
      if (
        typeof data.message !== "string" ||
        !Array.isArray(data.recommendations)
      )
        throw new Error("Couldn’t read suggestions. Please try again.");
      if (request.current === controller) setResult(data);
    } catch (err) {
      if (request.current === controller)
        setError(
          controller.signal.aborted
            ? "That took too long. Please try again."
            : err instanceof Error
              ? err.message
              : "Check your connection and try again.",
        );
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) {
        setLoading(false);
        request.current = null;
      }
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          accessibilityRole="button"
          accessibilityLabel="Close food recommender"
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 20,
              maxHeight: "90%",
              marginTop: insets.top + 16,
            },
          ]}
        >
          <View style={styles.heading}>
            <View style={styles.titleRow}>
              <Ionicons
                name="sparkles-outline"
                size={24}
                color={colors.accent}
                accessible={false}
              />
              <Text accessibilityRole="header" style={styles.title}>
                Your next good bite
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close food recommender"
              onPress={onClose}
              style={styles.close}
            >
              <Ionicons name="close" size={24} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <Text style={styles.copy}>
              Tell Cibo what you’re craving. We’ll find a few Toronto spots for
              you.
            </Text>
            <Text style={styles.label}>What sounds good?</Text>
            <TextInput
              autoFocus={visible}
              accessibilityLabel="Describe your food preferences"
              placeholder="A cuisine, neighborhood, or a mood…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={1000}
              value={prompt}
              onChangeText={setPrompt}
              style={styles.input}
              editable={!loading}
            />
            <View style={styles.starters}>
              {starters.map((text) => (
                <Pressable
                  key={text}
                  disabled={loading}
                  accessibilityRole="button"
                  onPress={() => setPrompt(text)}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.copy}>{text}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: loading || !prompt.trim(),
                busy: loading,
              }}
              disabled={loading || !prompt.trim()}
              onPress={recommend}
              style={({ pressed }) => [
                styles.submit,
                (loading || !prompt.trim() || pressed) && styles.pressed,
              ]}
            >
              {loading && <ActivityIndicator color={colors.white} />}
              <Text style={styles.submitText}>
                {loading ? "Finding your next bite…" : "Find my next bite"}
              </Text>
            </Pressable>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.copy}>
                {error}
              </Text>
            )}
            {result && (
              <View accessibilityLiveRegion="polite" style={styles.content}>
                <Text style={styles.copy}>{result.message}</Text>
                {result.recommendations.map((item) => {
                  const place = places.find((p) => p.id === item.id);
                  return place ? (
                    <Pressable
                      key={place.id}
                      accessibilityRole="button"
                      accessibilityLabel={`Show ${place.name} on map`}
                      onPress={() => onSelect(place)}
                      style={({ pressed }) => [
                        styles.card,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.name}>{place.name}</Text>
                      <Text style={styles.copy}>
                        {place.cuisine} · {place.neighborhood}
                      </Text>
                      <Text style={styles.copy}>{item.reason}</Text>
                      <Text style={styles.label}>Show on map →</Text>
                    </Pressable>
                  ) : null;
                })}
              </View>
            )}
            <Text style={styles.footnote}>
              AI suggestions use our restaurant directory. Confirm menus,
              prices, hours, and dietary needs with the restaurant.
            </Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
  },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  title: { fontSize: 22, fontWeight: "700", color: colors.ink, flexShrink: 1 },
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  content: { gap: 16 },
  copy: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  label: { color: colors.accent, fontSize: 14, fontWeight: "700" },
  input: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    minHeight: 100,
    padding: 16,
    color: colors.ink,
    fontSize: 16,
    textAlignVertical: "top",
  },
  starters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    backgroundColor: colors.tint,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 12,
  },
  submitText: { color: colors.white, fontSize: 16, fontWeight: "700" },
  pressed: { opacity: 0.6 },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: 18,
    gap: 8,
  },
  name: { fontSize: 18, fontWeight: "700", color: colors.ink },
  footnote: { fontSize: 12, lineHeight: 18, color: colors.muted },
});
