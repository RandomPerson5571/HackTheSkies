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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cameraColors, colors } from "../../../theme";
import type { FoodCapture } from "./FoodDexScreen";
import { FoodCameraView } from "../components/FoodCameraView";
import type { FoodCameraHandle } from "../components/FoodCameraView.types";
import { FoodBoundingBox } from "../components/FoodBoundingBox";
import { useLiveFoodDetection } from "../hooks/useLiveFoodDetection";
import { resizeScanImage, deleteScanImage } from "../services/scanImages";
import { recognizeFood, type FoodRecognition } from "../services/foodScanner";
import { overlap, type FoodTrack } from "../models/foodDetection";
import { useFoodDex } from "../hooks/useFoodDex";
import { foodKey } from "../models/foodDex";

export function FoodCameraScreen({
  onCapture,
  onClose,
}: {
  onCapture: (capture: FoodCapture) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
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
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [capturedTracks, setCapturedTracks] = useState<FoodTrack[]>([]);
  const [recognition, setRecognition] = useState<FoodRecognition | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const { entries } = useFoodDex();
  const live = useLiveFoodDetection(
    camera,
    ready && active && !photo,
    `${facing}-${attempt}`,
  );
  const boxes = photo ? capturedTracks : live.tracks;
  const selectedBox = boxes.find((box) => box.id === selectedId) ?? boxes[0];
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
  async function identify(
    image: CameraCapturedPicture,
    box: FoodTrack | undefined,
  ) {
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
      const resized = await resizeScanImage(image, 1024, true, box?.box);
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
      // Never capture concurrently with the live sampling loop.
      await live.pause();
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
      let tracks: FoodTrack[] = [];
      // Re-detect the captured image so the frozen box and upload crop match it.
      try {
        const detections = await live.detectCaptured(image);
        tracks = detections.map((detection, index) => ({
          ...detection,
          id: index + 1,
          hits: 1,
          missed: 0,
        }));
      } catch {
        /* Capturing and server recognition still work without a local detector. */
      }
      if (!mounted.current || current !== generation.current) return;
      const selected = selectedBox
        ? [...tracks].sort(
            (a, b) =>
              overlap(b.box, selectedBox.box) - overlap(a.box, selectedBox.box),
          )[0]
        : tracks[0];
      setCapturedTracks(tracks);
      setSelectedId(selected?.id ?? null);
      void identify(captured, selected);
    } catch {
      if (mounted.current)
        setError("We couldn’t take that photo. Please try again.");
      live.resume();
    } finally {
      if (raw) deleteScanImage(raw.uri);
      capturing.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function retake() {
    generation.current++;
    request.current?.abort();
    request.current = null;
    if (photo) deleteScanImage(photo.uri);
    live.resume();
    setReady(false);
    setAttempt((value) => value + 1);
    setPhoto(null);
    setCapturedTracks([]);
    setSelectedId(null);
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
            accessibilityLabel="Your captured food photo"
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
        {boxes.map((box) => (
          <FoodBoundingBox
            key={box.id}
            box={box.box}
            frame={photo ?? live.frame}
            preview={preview}
            mirrored={!photo && (live.frame.mirrored ?? facing === "front")}
            label={
              photo && box.id === selectedBox?.id
                ? resultLabel
                : "Food detected"
            }
            selected={box.id === selectedBox?.id}
            onSelect={() => {
              if (identifying || box.id === selectedBox?.id) return;
              setSelectedId(box.id);
              if (photo) {
                setRecognition(null);
              }
            }}
          />
        ))}
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
            Frame your dish, take a photo, then review the suggestion before
            saving it. Photos are sent to Groq to identify your meal. Live
            detection stays on your device.
          </Text>
          {!photo &&
            ready &&
            live.status.startsWith("Live detection unavailable") && (
              <>
                <Text style={s.panelCopy}>
                  Live food boxes are unavailable. Photo identification still
                  works.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={live.retry}
                  style={({ pressed }) => [s.secondary, pressed && s.pressed]}
                >
                  {icon("refresh-outline", 20)}
                  <Text style={s.secondaryText}>Retry live detection</Text>
                </Pressable>
              </>
            )}
        </ScrollView>
      )}
      <View style={[s.overlay, { bottom: insets.bottom + 24 }]}>
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
                onPress={() => void identify(photo, selectedBox)}
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
              onPress={() =>
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
                })
              }
              style={({ pressed }) => [
                s.primary,
                (pressed || identifying || busy) && s.pressed,
              ]}
            >
              <Text style={s.primaryText}>
                {identifying ? "Identifying…" : "Use photo"}
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
              accessibilityLabel="Take food photo"
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
