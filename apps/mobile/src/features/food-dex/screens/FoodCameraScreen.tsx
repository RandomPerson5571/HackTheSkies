import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useCameraPermissions,
  type CameraType,
  type CameraCapturedPicture,
} from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cameraColors, colors } from "../../../theme";
import type { FoodCapture } from "./FoodDexScreen";
import { FoodCameraView } from "../components/FoodCameraView";
import type { FoodCameraHandle } from "../components/FoodCameraView.types";
import { resizeScanImage, deleteScanImage } from "../services/scanImages";
import { recognizeFood, type FoodRecognition } from "../services/foodScanner";
import { useFoodDex } from "../hooks/useFoodDex";
import { foodKey } from "../models/foodDex";

export function FoodCameraScreen({
  onCapture,
  onClose,
  initialMode = "food",
  onMenuCapture,
  onMenuExplore,
}: {
  onCapture: (capture: FoodCapture) => void;
  onClose: () => void;
  initialMode?: "food" | "menu";
  onMenuCapture: (photo: CameraCapturedPicture) => void;
  onMenuExplore: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState(initialMode);
  const camera = useRef<FoodCameraHandle>(null);
  const mounted = useRef(true);
  const capturing = useRef(false);
  const [permission, requestPermission, refreshPermission] =
    useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<CameraCapturedPicture | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState(AppState.currentState === "active");
  const [attempt, setAttempt] = useState(0);
  const [preview, setPreview] = useState({ width: 0, height: 0 });
  const [recognition, setRecognition] = useState<FoodRecognition | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const { entries } = useFoodDex();
  const collected =
    recognition &&
    entries.some(
      (entry) =>
        foodKey(entry.name, entry.cuisine) ===
        foodKey(recognition.name, recognition.cuisine),
    );
  const resultLabel = identifying
    ? "Identifying meal…"
    : recognition
      ? `${recognition.name} · ${collected ? "Collected" : recognition.catalogId ? "New badge" : "New discovery"}`
      : "Food detected";

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      setReady(false);
      setActive(state === "active");
      if (state === "active") void refreshPermission().catch(() => {});
    });
    return () => {
      mounted.current = false;
      request.current?.abort();
      subscription.remove();
    };
  }, [refreshPermission]);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  async function enableCamera() {
    setError("");
    try {
      await requestPermission();
    } catch {
      setError(
        "Camera access failed. Check your camera permissions and try again.",
      );
    }
  }
  async function identify(image: CameraCapturedPicture) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    setIdentifying(true);
    setRecognition(null);
    setError("");
    let upload: { uri: string } | undefined;
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const resized = await resizeScanImage(image, 1024, true);
      upload = resized;
      if (!resized.base64 || controller.signal.aborted)
        throw new Error("Recognition was interrupted. Please try again.");
      const result = await recognizeFood(resized.base64, controller.signal);
      if (mounted.current && generation.current === current) {
        setRecognition(result);
        if (!result)
          setError(
            "No meal was identified. Retake the photo or enter the dish yourself.",
          );
      }
    } catch (cause) {
      if (mounted.current && generation.current === current)
        setError(
          controller.signal.aborted
            ? "Recognition timed out. Retry or add the meal by hand."
            : cause instanceof Error
              ? cause.message
              : "Couldn’t identify this meal.",
        );
    } finally {
      clearTimeout(timeout);
      if (upload) deleteScanImage(upload.uri);
      if (mounted.current && generation.current === current) {
        setIdentifying(false);
        request.current = null;
      }
    }
  }
  async function snap() {
    if (!camera.current || !ready || capturing.current) return;
    capturing.current = true;
    setBusy(true);
    setError("");
    const current = generation.current;
    let raw: CameraCapturedPicture | undefined;
    try {
      if (!mounted.current || !camera.current || current !== generation.current)
        return;
      raw = await camera.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });
      const image = await resizeScanImage(
        raw,
        mode === "menu" ? 1800 : 1024,
        true,
      );
      if (!mounted.current || current !== generation.current) {
        deleteScanImage(image.uri);
        return;
      }
      const captured: CameraCapturedPicture = { ...image, format: "jpg" };
      setPhoto(captured);
      if (mode === "menu") return;
      void identify(captured);
    } catch {
      if (mounted.current)
        setError("We couldn’t take that photo. Please try again.");
    } finally {
      if (raw) deleteScanImage(raw.uri);
      capturing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function selectPhoto() {
    if (capturing.current) return;
    capturing.current = true;
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      const asset = result.assets?.[0];
      if (
        result.canceled ||
        !asset ||
        !mounted.current ||
        current !== generation.current
      )
        return;
      const image = await resizeScanImage(
        asset,
        mode === "menu" ? 1800 : 1024,
        true,
      );
      if (!mounted.current || current !== generation.current) {
        deleteScanImage(image.uri);
        return;
      }
      const captured: CameraCapturedPicture = { ...image, format: "jpg" };
      setPhoto(captured);
      if (mode === "food") void identify(captured);
    } catch {
      if (mounted.current && current === generation.current)
        setError("Couldn’t open that photo. Try another image.");
    } finally {
      capturing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function retake() {
    generation.current++;
    request.current?.abort();
    request.current = null;
    if (photo) deleteScanImage(photo.uri);
    setReady(false);
    setAttempt((value) => value + 1);
    setPhoto(null);
    setRecognition(null);
    setIdentifying(false);
    setError("");
  }
  const icon = (
    name: React.ComponentProps<typeof Ionicons>["name"],
    size = 24,
  ) => (
    <Ionicons
      name={name}
      size={size}
      color={cameraColors.foreground}
      accessible={false}
    />
  );

  return (
    <View style={s.screen}>
      <View
        style={s.viewfinder}
        onLayout={(event) => setPreview(event.nativeEvent.layout)}
      >
        {photo ? (
          <Image
            source={{ uri: photo.uri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            accessibilityLabel={
              mode === "menu"
                ? "Your captured menu photo"
                : "Your captured food photo"
            }
          />
        ) : permission?.granted && active ? (
          <FoodCameraView
            key={`${facing}-${attempt}`}
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash="off"
            enableTorch={flash && facing === "back"}
            mode="picture"
            mirror={false}
            animateShutter={false}
            autofocus="on"
            onCameraReady={() => setReady(true)}
            onMountError={({ message }) => {
              setReady(false);
              setError(
                Platform.OS === "web"
                  ? `${message} Check camera access in your browser, then retry.`
                  : "Your camera couldn’t start. Check that it isn’t in use, then retry.",
              );
            }}
          />
        ) : (
          <View style={s.permission}>
            {icon("camera-outline", 48)}
            <Text style={s.permissionTitle}>
              {permission
                ? "Let’s see what’s cooking."
                : "Getting your camera ready…"}
            </Text>
            <Text style={s.panelCopy}>
              {mode === "menu"
                ? "Allow camera access to scan a menu right here in Cibo."
                : "Allow camera access to photograph food right here in Cibo."}
            </Text>
            {!permission ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  if (!permission.canAskAgain && Platform.OS !== "web")
                    void Linking.openSettings().catch(() =>
                      setError("Open device settings to allow camera access."),
                    );
                  else void enableCamera();
                }}
                style={({ pressed }) => [s.primary, pressed && s.pressed]}
              >
                <Text style={s.primaryText}>
                  {permission.canAskAgain || Platform.OS === "web"
                    ? "Enable camera"
                    : "Open settings"}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        {mode === "menu" && !photo && permission?.granted && (
          <View pointerEvents="none" style={s.menuGuide}>
            <Text style={s.menuHint}>Keep the full menu in the frame</Text>
          </View>
        )}
      </View>
      <View
        pointerEvents="box-none"
        style={[s.topBar, { top: insets.top + 16 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          onPress={onClose}
          style={({ pressed }) => [s.round, pressed && s.pressed]}
        >
          {icon("close-outline")}
        </Pressable>
        <View
          accessibilityRole="tablist"
          accessibilityLabel="Scan mode"
          style={s.modeSelector}
        >
          {(["food", "menu"] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="tab"
              accessibilityLabel={
                value === "food" ? "Food detector" : "Menu Lens"
              }
              accessibilityState={{ selected: mode === value, disabled: busy }}
              disabled={busy}
              onPress={() => {
                if (mode === value) return;
                retake();
                setMode(value);
              }}
              style={({ pressed }) => [
                s.modeOption,
                mode === value && s.selected,
                pressed && s.pressed,
              ]}
            >
              <Text style={s.secondaryText}>
                {value === "food" ? "Food" : "Menu"}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            showInfo ? "Hide camera help" : "Camera help and privacy"
          }
          accessibilityState={{ expanded: showInfo }}
          onPress={() => setShowInfo((value) => !value)}
          style={({ pressed }) => [s.round, pressed && s.pressed]}
        >
          {icon("information-circle-outline")}
        </Pressable>
      </View>
      {showInfo && (
        <ScrollView
          contentContainerStyle={s.infoContent}
          style={[
            s.info,
            {
              top: insets.top + 76,
              maxHeight: Math.max(
                120,
                preview.height - insets.top - insets.bottom - 200,
              ),
            },
          ]}
        >
          <Text style={s.panelTitle}>
            {mode === "menu"
              ? "Explore with Menu Lens"
              : "Capture a food discovery"}
          </Text>
          <Text style={s.panelCopy}>
            {mode === "menu"
              ? "Frame the full menu with readable dish names, take a photo, then scan it to explore dishes, discoveries, and dietary details. Captured menus are sent to our AI service."
              : "Frame your dish, take a photo, then review the suggestion before saving it. Only the photo you take or select is uploaded to identify your meal. Review the result before adding it to your collection."}
          </Text>
        </ScrollView>
      )}
      <View style={[s.overlay, { bottom: insets.bottom + 24 }]}>
        {!photo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void selectPhoto()}
            style={({ pressed }) => [
              s.secondary,
              (pressed || busy) && s.pressed,
            ]}
          >
            {icon("images-outline", 20)}
            <Text style={s.secondaryText}>
              {busy ? "Preparing photo…" : "Choose a photo"}
            </Text>
          </Pressable>
        )}
        {mode === "menu" && !photo && (
          <Pressable
            accessibilityRole="button"
            onPress={onMenuExplore}
            disabled={busy}
            style={({ pressed }) => [s.secondary, pressed && s.pressed]}
          >
            {icon("image-outline", 20)}
            <Text style={s.secondaryText}>Upload or try a sample menu</Text>
          </Pressable>
        )}
        {!!error && (
          <View accessibilityLiveRegion="polite" style={s.errorRow}>
            <Text style={s.error}>{error}</Text>
            {!ready && !photo && permission?.granted && (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setError("");
                  setAttempt((value) => value + 1);
                }}
                style={s.retry}
              >
                <Text style={s.secondaryText}>Retry</Text>
              </Pressable>
            )}
          </View>
        )}
        {photo && (
          <View style={s.result}>
            <View style={s.resultHeading}>
              {identifying && (
                <ActivityIndicator color={cameraColors.foreground} />
              )}
              <Text accessibilityLiveRegion="polite" style={s.panelTitle}>
                {mode === "menu"
                  ? "Ready to scan your menu"
                  : identifying
                    ? "Identifying your dish…"
                    : recognition
                      ? resultLabel
                      : "Review your photo"}
              </Text>
            </View>
            {mode === "food" && !identifying && !recognition && (
              <Pressable
                accessibilityRole="button"
                onPress={() => void identify(photo)}
                style={({ pressed }) => [s.secondary, pressed && s.pressed]}
              >
                {icon("refresh-outline", 20)}
                <Text style={s.secondaryText}>Try identification again</Text>
              </Pressable>
            )}
          </View>
        )}
        {photo ? (
          <View style={s.controls}>
            <Pressable
              accessibilityRole="button"
              onPress={retake}
              style={({ pressed }) => [s.secondary, pressed && s.pressed]}
            >
              {icon("refresh-outline", 20)}
              <Text style={s.secondaryText}>Retake</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={identifying || busy}
              accessibilityState={{ disabled: identifying || busy }}
              onPress={() => {
                if (mode === "menu") {
                  onMenuCapture(photo);
                  return;
                }
                onCapture({
                  id: Date.now(),
                  error: "",
                  recognition,
                  photo: {
                    uri: photo.uri,
                    width: photo.width,
                    height: photo.height,
                    base64: photo.base64,
                    mimeType: "image/jpeg",
                    type: "image",
                  },
                });
              }}
              style={({ pressed }) => [
                s.primary,
                (pressed || identifying || busy) && s.pressed,
              ]}
            >
              <Text style={s.primaryText}>
                {mode === "menu"
                  ? "Scan menu"
                  : identifying
                    ? "Identifying…"
                    : "Use photo"}
              </Text>
              <Ionicons
                name="arrow-forward"
                size={20}
                color={colors.white}
                accessible={false}
              />
            </Pressable>
          </View>
        ) : permission?.granted && active ? (
          <View style={s.controls}>
            {Platform.OS !== "web" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={flash ? "Turn light off" : "Turn light on"}
                accessibilityState={{
                  disabled: busy || facing === "front",
                  selected: flash,
                }}
                disabled={busy || facing === "front"}
                onPress={() => setFlash((value) => !value)}
                style={({ pressed }) => [
                  s.round,
                  flash && s.selected,
                  (busy || facing === "front") && s.disabled,
                  pressed && s.pressed,
                ]}
              >
                {icon(flash ? "flash" : "flash-off-outline")}
              </Pressable>
            ) : (
              <View style={s.controlSpacer} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === "menu" ? "Take menu photo" : "Take food photo"
              }
              accessibilityState={{ disabled: !ready || busy, busy }}
              disabled={!ready || busy}
              onPress={() => void snap()}
              style={({ pressed }) => [
                s.shutter,
                (!ready || busy || pressed) && s.pressed,
              ]}
            >
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <View style={s.shutterInner} />
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Switch camera"
              accessibilityState={{ disabled: busy || !ready }}
              disabled={busy || !ready}
              onPress={() => {
                setReady(false);
                setFacing((value) => (value === "back" ? "front" : "back"));
              }}
              style={({ pressed }) => [
                s.round,
                (busy || !ready) && s.disabled,
                pressed && s.pressed,
              ]}
            >
              {icon("camera-reverse-outline")}
            </Pressable>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: cameraColors.background },
  viewfinder: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
    backgroundColor: cameraColors.background,
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  modeSelector: {
    flexDirection: "row",
    backgroundColor: cameraColors.surface,
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: cameraColors.border,
  },
  modeOption: {
    minWidth: 64,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    paddingHorizontal: 12,
  },
  menuGuide: {
    position: "absolute",
    top: "24%",
    bottom: "30%",
    left: "10%",
    right: "10%",
    borderWidth: 1,
    borderColor: cameraColors.foreground,
    borderRadius: 16,
    justifyContent: "flex-end",
    alignItems: "center",
    padding: 12,
  },
  menuHint: {
    color: cameraColors.foreground,
    backgroundColor: cameraColors.surface,
    borderRadius: 12,
    padding: 10,
    fontSize: 13,
    textAlign: "center",
  },
  overlay: {
    position: "absolute",
    alignSelf: "center",
    width: "100%",
    maxWidth: 440,
    paddingHorizontal: 20,
    gap: 16,
  },
  info: {
    position: "absolute",
    right: 16,
    width: "92%",
    maxWidth: 360,
    alignSelf: "center",
    backgroundColor: cameraColors.surface,
    borderRadius: 20,
  },
  infoContent: { padding: 20, gap: 12 },
  panelTitle: {
    color: cameraColors.foreground,
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "600",
    flexShrink: 1,
  },
  panelCopy: {
    color: cameraColors.muted,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 320,
  },
  permission: {
    flex: 1,
    backgroundColor: cameraColors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    color: cameraColors.foreground,
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  result: {
    backgroundColor: cameraColors.surface,
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  resultHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  controls: {
    width: "100%",
    maxWidth: 300,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  round: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: cameraColors.surface,
    borderWidth: 1,
    borderColor: cameraColors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  controlSpacer: { width: 48, height: 48 },
  selected: { backgroundColor: colors.accent },
  shutter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: cameraColors.foreground,
    backgroundColor: cameraColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: cameraColors.foreground,
  },
  primary: {
    minHeight: 48,
    borderRadius: 24,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: colors.white, fontSize: 15, fontWeight: "600" },
  secondary: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 24,
    backgroundColor: cameraColors.surface,
  },
  secondaryText: {
    color: cameraColors.foreground,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: cameraColors.surface,
    borderRadius: 16,
    padding: 12,
  },
  error: {
    flex: 1,
    color: cameraColors.foreground,
    fontSize: 13,
    lineHeight: 19,
  },
  retry: { minHeight: 48, justifyContent: "center", padding: 8 },
  disabled: { opacity: 0.35 },
  pressed: { opacity: 0.6 },
});
