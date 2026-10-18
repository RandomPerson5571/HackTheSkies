import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { playFeedback } from "../../../lib/sensory";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  Linking,
  Platform,
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
import type { DishBounds } from "../models/foodTracking";
import { DishOverlay } from "../components/DishOverlay";
import { useReducedMotion } from "../hooks/useReducedMotion";

export function FoodCameraScreen({
  onCapture,
  onClose,
}: {
  onCapture: (capture: FoodCapture) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [live, setLive] = useState(true);
  const [catching, setCatching] = useState(false);
  const catchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [anchor, setAnchor] = useState<DishBounds>({
    x: 0.3,
    y: 0.3,
    width: 0.4,
    height: 0.24,
    visible: false,
  });
  const [trackingError, setTrackingError] = useState("");
  const scanned = useRef(false);
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
      if (state !== "active") {
        generation.current++;
        request.current?.abort();
        setIdentifying(false);
        setLive(false);
        setCatching(false);
        if (catchTimer.current) clearTimeout(catchTimer.current);
      }
      setActive(state === "active");
      if (state === "active") void refreshPermission().catch(() => {});
    });
    return () => {
      mounted.current = false;
      request.current?.abort();
      if (catchTimer.current) clearTimeout(catchTimer.current);
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

  function reviewCapture() {
    if (!photo || identifying || busy || catching) return;
    const capture: FoodCapture = {
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
    };
    setLive(false);
    if (!recognition) {
      onCapture(capture);
      return;
    }
    setCatching(true);
    void playFeedback(collected ? "select" : "discover");
    catchTimer.current = setTimeout(
      () => {
        if (mounted.current) onCapture(capture);
      },
      reduced === false ? 700 : 0,
    );
  }

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
        if (result) {
          void playFeedback("bell");
        } else {
          void playFeedback("error");
        }
        if (!result)
          setError(
            "No meal was identified. Retake the photo or enter the dish yourself.",
          );
      }
    } catch (cause) {
      if (mounted.current && generation.current === current) {
        void playFeedback("error");
        setError(
          controller.signal.aborted
            ? "Recognition timed out. Retry or add the meal by hand."
            : cause instanceof Error
              ? cause.message
              : "Couldn’t identify this meal.",
        );
      }
    } finally {
      clearTimeout(timeout);
      if (upload) deleteScanImage(upload.uri);
      if (mounted.current && generation.current === current) {
        setIdentifying(false);
        request.current = null;
      }
    }
  }
  async function scanPreview() {
    if (!camera.current || capturing.current || scanned.current) return;
    scanned.current = true;
    capturing.current = true;
    let image: CameraCapturedPicture | undefined;
    const current = generation.current;
    try {
      image = await camera.current.takePictureAsync({
        quality: 0.5,
        base64: false,
      });
      if (mounted.current && current === generation.current)
        await identify(image);
    } catch {
      if (mounted.current && current === generation.current)
        setError(
          "Live scan failed. Take a photo or restart Live scan to retry.",
        );
    } finally {
      if (image) deleteScanImage(image.uri);
      capturing.current = false;
    }
  }
  const autoSnap = useEffectEvent(() => void scanPreview());
  // Recognize once per live session; tracking stays entirely on device.
  useEffect(() => {
    if (
      !live ||
      !ready ||
      !active ||
      photo ||
      busy ||
      identifying ||
      error ||
      scanned.current
    )
      return;
    const timer = setTimeout(autoSnap, 1600);
    return () => clearTimeout(timer);
  }, [live, ready, active, photo, busy, identifying, error]);

  async function snap() {
    if (!camera.current || !ready || capturing.current) return;
    capturing.current = true;
    void playFeedback("interfaceClick");
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
      const image = await resizeScanImage(raw, 1024, true);
      if (!mounted.current || current !== generation.current) {
        deleteScanImage(image.uri);
        return;
      }
      const captured: CameraCapturedPicture = { ...image, format: "jpg" };
      setPhoto(captured);
      if (!recognition || !live) void identify(captured);
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
    setLive(false);
    capturing.current = true;
    void playFeedback("alert");
    setBusy(true);
    setError("");
    const current = generation.current;
    try {
      // With editing enabled the picker uses the photo roll, which requires
      // explicit permission; requesting it first keeps a denied library from
      // silently canceling the selection.
      if (Platform.OS !== "web") {
        const mediaLibrary =
          await ImagePicker.requestMediaLibraryPermissionsAsync().catch(
            () => null,
          );
        if (!mediaLibrary?.granted) {
          if (mediaLibrary && !mediaLibrary.canAskAgain) {
            void Linking.openSettings().catch(() =>
              setError("Open device settings to allow photo access."),
            );
            setError(
              "Cibo needs photo access to choose from your library. Allow it in Settings, then try again.",
            );
          } else
            setError(
              "Cibo needs photo access to choose from your library. Try again and choose Allow.",
            );
          return;
        }
      }
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
      const image = await resizeScanImage(asset, 1024, true);
      if (!mounted.current || current !== generation.current) {
        deleteScanImage(image.uri);
        return;
      }
      const captured: CameraCapturedPicture = { ...image, format: "jpg" };
      setPhoto(captured);
      void identify(captured);
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
    scanned.current = false;
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
            accessibilityLabel={"Your captured food photo"}
          />
        ) : permission?.granted && active ? (
          <FoodCameraView
            key={`${facing}-${attempt}-${active}`}
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing={facing}
            flash="off"
            enableTorch={flash && facing === "back"}
            mode="picture"
            mirror={false}
            animateShutter={false}
            autofocus="on"
            tracking={live && !photo && active && ready}
            onTracking={setAnchor}
            onTrackingError={setTrackingError}
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
              Allow camera access to photograph food right here in Cibo.
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
      </View>
      {((live && !photo && ready) || recognition) && (
        <DishOverlay
          key={
            recognition
              ? `${recognition.name}-${recognition.cuisine}`
              : "scanning"
          }
          preview={preview}
          anchor={photo && !anchor.visible ? undefined : anchor}
          scanning={!recognition}
          recognition={recognition}
          collected={!!collected}
          catching={catching}
        />
      )}
      <View
        pointerEvents="box-none"
        style={[s.topBar, { top: insets.top + 16 }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          onPress={() => {
            if (catchTimer.current) clearTimeout(catchTimer.current);
            onClose();
          }}
          style={({ pressed }) => [s.round, pressed && s.pressed]}
        >
          {icon("close-outline")}
        </Pressable>
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
          <Text style={s.panelTitle}>Capture a food discovery</Text>
          <Text style={s.panelCopy}>
            Live scan identifies a dish once before you take a photo. Object
            tracking follows the dish locally; keep it in frame. Toggle Live
            scan off and on to identify a new dish. Confirm the dish before
            saving it and earning XP.
          </Text>
        </ScrollView>
      )}
      <View style={[s.overlay, { bottom: insets.bottom + 24 }]}>
        {!photo && permission?.granted && active && (
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel="Live scan: upload a snapshot after a short pause"
            accessibilityHint="Uploads one camera snapshot to identify your dish. Hold steady when enabled."
            accessibilityState={{ checked: live, disabled: busy || !ready }}
            disabled={busy || !ready}
            onPress={() => {
              generation.current++;
              request.current?.abort();
              scanned.current = false;
              setTrackingError("");
              setAnchor((value) => ({ ...value, visible: false }));
              setRecognition(null);
              setIdentifying(false);
              setError("");
              setLive((value) => !value);
            }}
            style={({ pressed }) => [
              s.liveScan,
              live && s.selected,
              pressed && s.pressed,
            ]}
          >
            {icon("scan-outline", 16)}
            <Text style={s.secondaryText}>
              {live ? "Live scan on" : "Live scan"}
            </Text>
          </Pressable>
        )}
        {!!trackingError && !photo && (
          <Text style={s.panelCopy}>{trackingError}</Text>
        )}
        {!photo && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a photo from your library"
            accessibilityState={{ disabled: busy, busy }}
            disabled={busy}
            onPress={() => void selectPhoto()}
            style={({ pressed }) => [
              s.secondary,
              s.choosePhoto,
              (pressed || busy) && s.pressed,
            ]}
          >
            {icon("images-outline", 16)}
            <Text style={s.secondaryText}>
              {busy ? "Preparing photo…" : "Choose a photo"}
            </Text>
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
                {identifying
                  ? "Identifying your dish…"
                  : recognition
                    ? resultLabel
                    : "Review your photo"}
              </Text>
            </View>
            {!identifying && !recognition && (
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
              disabled={catching}
              accessibilityState={{ disabled: catching }}
              onPress={retake}
              style={({ pressed }) => [s.secondary, pressed && s.pressed]}
            >
              {icon("refresh-outline", 20)}
              <Text style={s.secondaryText}>
                {live ? "Scan next dish" : "Retake"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={identifying || busy || catching}
              accessibilityState={{ disabled: identifying || busy || catching }}
              onPress={reviewCapture}
              style={({ pressed }) => [
                s.primary,
                (pressed || identifying || busy) && s.pressed,
              ]}
            >
              <Text style={s.primaryText}>
                {catching
                  ? "Caught!"
                  : identifying
                    ? "Identifying…"
                    : recognition
                      ? collected
                        ? "Review dish"
                        : "Catch & review"
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
              accessibilityLabel={"Take food photo"}
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
                scanned.current = false;
                setTrackingError("");
                setAnchor((value) => ({ ...value, visible: false }));
                setRecognition(null);
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
  choosePhoto: {
    alignSelf: "center",
    gap: 6,
    paddingHorizontal: 14,
  },
  liveScan: {
    alignSelf: "center",
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
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
