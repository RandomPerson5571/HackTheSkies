import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../theme/index";
import { readFoodTag } from "../services/nfcReader";
import { parseNfcFoodPayload } from "../services/nfcFood";
import type { NfcFoodItem } from "../services/nfcFood";

function Icon({
  name,
  size = 22,
  color = colors.accent,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}

export function NfcScanScreen({
  visible,
  onCancel,
  onRead,
}: {
  visible: boolean;
  onCancel: () => void;
  onRead: (food: NfcFoodItem) => void;
}) {
  const insets = useSafeAreaInsets();
  const [attempt, setAttempt] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [foodNumber, setFoodNumber] = useState("");
  const activeScan = useRef<AbortController | null>(null);

  const startScan = useCallback(async () => {
    activeScan.current?.abort();
    const controller = new AbortController();
    activeScan.current = controller;
    setScanning(true);
    setError("");
    try {
      const food = await readFoodTag(controller.signal);
      if (!controller.signal.aborted) onRead(food);
    } catch (reason: unknown) {
      if (!controller.signal.aborted) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Couldn’t read this NFC tag. Try again.",
        );
      }
    } finally {
      if (activeScan.current === controller) activeScan.current = null;
      if (!controller.signal.aborted) setScanning(false);
    }
  }, [onRead]);

  useEffect(() => {
    if (!visible) {
      activeScan.current?.abort();
      return;
    }
    if (Platform.OS === "web") return;
    void startScan();
    return () => activeScan.current?.abort();
  }, [attempt, startScan, visible]);

  function recordByNumber() {
    const food = parseNfcFoodPayload(foodNumber);
    if (!food) {
      setError("Enter a valid food number from the Food Dex.");
      return;
    }
    onRead(food);
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <View style={s.overlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel NFC scan"
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[s.sheet, { paddingBottom: insets.bottom + 24 }]}
        >
          <View style={s.heading}>
            <Text style={[s.eyebrow, s.flex]}>FOOD DEX</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel NFC scan"
              onPress={onCancel}
              style={s.closeButton}
            >
              <Icon name="close" />
            </Pressable>
          </View>
          <View style={s.content}>
            <View style={s.badge}>
              <Icon name="scan-outline" size={34} />
            </View>
            <Text accessibilityRole="header" style={s.title}>
              Scan a food tag
            </Text>
            <Text style={s.copy}>
              {Platform.OS === "web"
                ? "Tap to scan an NFC tag, or enter its food number below."
                : "Hold your phone near a tag with a food number, dish name, or food link."}
            </Text>
            {scanning ? (
              <View style={s.status}>
                <ActivityIndicator color={colors.accent} />
                <Text style={s.statusText}>Waiting for an NFC tag…</Text>
              </View>
            ) : error ? (
              <>
                <Text accessibilityRole="alert" style={s.error}>
                  {error}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    Platform.OS === "web"
                      ? void startScan()
                      : setAttempt((current) => current + 1)
                  }
                  style={({ pressed }) => [s.retry, pressed && s.dim]}
                >
                  <Icon name="refresh-outline" color={colors.white} />
                  <Text style={s.retryText}>Try again</Text>
                </Pressable>
              </>
            ) : Platform.OS === "web" ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void startScan()}
                style={({ pressed }) => [s.retry, pressed && s.dim]}
              >
                <Icon name="scan-outline" color={colors.white} />
                <Text style={s.retryText}>Start NFC scan</Text>
              </Pressable>
            ) : null}
            {Platform.OS === "web" && (
              <View style={s.manualEntry}>
                <TextInput
                  accessibilityLabel="Food number"
                  keyboardType="number-pad"
                  value={foodNumber}
                  onChangeText={setFoodNumber}
                  onSubmitEditing={recordByNumber}
                  placeholder="Food number"
                  placeholderTextColor={colors.muted}
                  returnKeyType="done"
                  style={s.numberInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Record food by number"
                  onPress={recordByNumber}
                  style={({ pressed }) => [s.numberButton, pressed && s.dim]}
                >
                  <Icon name="add" color={colors.white} size={20} />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#3D568F99",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    paddingBottom: 24,
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  heading: {
    minHeight: 58,
    paddingLeft: 22,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  flex: { flex: 1 },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.1,
  },
  closeButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 28,
  },
  badge: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: colors.tint,
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  copy: {
    maxWidth: 320,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  statusText: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  manualEntry: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  numberInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    color: colors.ink,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  numberButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  error: {
    width: "100%",
    color: colors.ink,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  retry: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.accent,
  },
  retryText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  dim: { opacity: 0.65 },
});
