import { CiboLogo } from "../../../components/CiboLogo";
import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../../../theme/index";
import { playSound, hapticSuccess, hapticLight } from "../../../lib/sensory";
import type { Profile } from "../models/profile";

const diets = ["No preference", "Vegetarian", "Vegan", "Pescatarian"] as const;

export function SettingsScreen({
  profile,
  onSave,
  topInset,
  bottomInset,
  storageError,
  onBack,
}: {
  profile: Profile;
  onSave: (profile: Profile) => void;
  topInset: number;
  bottomInset: number;
  storageError: string;
  onBack: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [message, setMessage] = useState("");
  const edited = useRef(false);
  useEffect(() => {
    if (!edited.current) setDraft(profile);
  }, [profile]);

  function update(change: Partial<Profile>) {
    edited.current = true;
    setDraft((current) => ({ ...current, ...change }));
    setMessage("");
  }
  function save() {
    if (!draft.name.trim()) {
      setMessage("Please enter a display name.");
      return;
    }
    const next = {
      ...draft,
      name: draft.name.trim(),
      neighborhood: draft.neighborhood.trim(),
    };
    setDraft(next);
    edited.current = false;
    onSave(next);
    setMessage("Settings saved.");
    void playSound("success");
    hapticSuccess();
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 24, paddingBottom: bottomInset + 112 },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to profile"
          onPress={onBack}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="chevron-back" color={colors.ink} size={22} />
        </Pressable>
        <View style={styles.headerTitle}>
          <CiboLogo />
          <Text accessibilityRole="header" style={styles.title}>
            Settings
          </Text>
        </View>
        <View style={styles.backButton} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.label}>Display name</Text>
        <TextInput
          accessibilityLabel="Display name"
          style={styles.input}
          value={draft.name}
          onChangeText={(name) => update({ name })}
          maxLength={50}
          autoComplete="name"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
        />
        <Text style={styles.label}>Home neighborhood</Text>
        <TextInput
          accessibilityLabel="Home neighborhood"
          style={styles.input}
          value={draft.neighborhood}
          onChangeText={(neighborhood) => update({ neighborhood })}
          maxLength={80}
          placeholder="e.g. Kensington Market"
          placeholderTextColor={colors.muted}
          returnKeyType="done"
        />
        <Text style={styles.label}>Dietary preference</Text>
        <View style={styles.choices}>
          {diets.map((diet) => (
            <Pressable
              key={diet}
              accessibilityRole="radio"
              accessibilityState={{ checked: draft.diet === diet }}
              onPress={() => {
                update({ diet });
                void playSound("tap");
                hapticLight();
              }}
              style={({ pressed }) => [
                styles.choice,
                draft.diet === diet && styles.choiceSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.choiceText,
                  draft.diet === diet && styles.choiceTextSelected,
                ]}
              >
                {diet}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={save}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>Save settings</Text>
          <Ionicons name="checkmark" color={colors.white} size={19} />
        </Pressable>
        {message ? (
          <Text accessibilityRole="alert" style={styles.hint}>
            {message}
          </Text>
        ) : null}
      </View>

      {storageError ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          {storageError}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 20,
    gap: 18,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { alignItems: "center", gap: 6 },
  title: { color: colors.muted, fontSize: 13, fontWeight: "400" },
  card: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: "700" },
  label: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: colors.paper,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    minHeight: 48,
  },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: "center",
  },
  choiceSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  choiceText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  choiceTextSelected: { color: colors.white },
  save: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  saveText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  hint: { color: colors.accent, fontSize: 12, lineHeight: 19 },
  pressed: { opacity: 0.65 },
});
