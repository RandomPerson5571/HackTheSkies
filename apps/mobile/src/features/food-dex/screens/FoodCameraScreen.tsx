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
import {
  normalizedBoxToDetection,
  projectDish,
  type DishBounds,
} from "../models/foodTracking";
import { DishOverlay } from "../components/DishOverlay";

// The Groq estimate backs up YOLO when tracking misses: wait out bursts of
// misses (debounce), then probe with full frames spaced by a cooldown so a
// bad angle cannot flood the recognition server. One probe runs at a time.
const FALLBACK_DEBOUNCE_MS = 800;
const FALLBACK_COOLDOWN_MS = 7_000;
const FALLBACK_MAX_ATTEMPTS = 2;

export function FoodCameraScreen({
  onCapture,
  onClose,
}: {
  onCapture: (capture: FoodCapture) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [live, setLive] = useState(true);
  const catching = false;
  const retainedPhoto = useRef<string | null>(null);

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
  const [noFood, setNoFood] = useState(false);
  const [recognition, setRecognition] = useState<FoodRecognition | null>(null);
  const [anchor, setAnchor] = useState<DishBounds>({
    x: 0.3,
    y: 0.3,
    width: 0.4,
    height: 0.24,
    visible: false,
  });
  // Coordinates for hidden boxes are always the last meaningful fractions,
  // never (0, 0); only `visible` drops when a detection leaves the frame.
  const anchorRef = useRef(anchor);
  function hideAnchor() {
    anchorRef.current = { ...anchorRef.current, visible: false };
    setAnchor(anchorRef.current);
  }
  function showAnchor(bounds: DishBounds) {
    anchorRef.current = bounds;
    setAnchor(bounds);
  }
  const [trackingError, setTrackingError] = useState("");
  const [dismissedWarning, setDismissedWarning] = useState("");
  const warning = error || (!photo ? trackingError : "");
  const showWarning = !!warning && warning !== dismissedWarning;

  useEffect(() => {
    if (!warning) setDismissedWarning("");
  }, [warning]);
  const scanned = useRef(false);
  const trackingActive = useRef(false);
  const [identifying, setIdentifying] = useState(false);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  // Groq fallback budget: the vision estimate backs up YOLO when it misses,
  // debounced after misses, cooled down between requests, one in flight.
  const fallbackLeft = useRef(FALLBACK_MAX_ATTEMPTS);
  const fallbackLast = useRef(0);
  const fallbackMissing = useRef(0);
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
      ? `Looks like ${recognition.name}`
      : "Food detected";
  // The overlay persists through the post-photo identify, so the box and
  // award cards never flicker off while the scan is running.
  const foodInFrame =
    !!recognition ||
    !!catching ||
    (!noFood && anchor.visible && live && !photo && ready) ||
    (!!photo && identifying);

  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener("change", (state) => {
      setReady(false);
      if (state !== "active") {
        generation.current++;
        request.current?.abort();
        setIdentifying(false);
        setLive(false);
      }
      setActive(state === "active");
      if (state === "active") void refreshPermission().catch(() => {});
    });
    return () => {
      mounted.current = false;
      request.current?.abort();
      subscription.remove();
      if (retainedPhoto.current) deleteScanImage(retainedPhoto.current);
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

  const delivered = useRef(false);
  function deliverCapture(manual = false) {
    if (delivered.current) return;
    delivered.current = true;
    generation.current++;
    request.current?.abort();
    request.current = null;
    retainedPhoto.current = null;
    onCapture({
      id: Date.now(),
      error: manual ? "" : error,
      recognition: manual ? null : recognition,
      photo: photo ? { ...photo, mimeType: "image/jpeg", type: "image" } : null,
    });
  }
  const finishCapture = useEffectEvent(() => deliverCapture());
  useEffect(() => {
    if (photo && !identifying && !busy) finishCapture();
  }, [photo, identifying, busy]);

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
  // `quiet` marks the YOLO-failure fallback probes: they retry on a cooldown
  // and must not spam errors the user cannot act on.
  async function identify(
    image: CameraCapturedPicture,
    quiet = false,
    fromPreview = false,
  ) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const current = ++generation.current;
    setIdentifying(true);
    setRecognition(null);
    setError("");
    let upload: { uri: string } | undefined;
    let retained = false;
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
          setNoFood(false);
          // Keep on-device tracking visible while live recognition is shown.
          const liveBox =
            fromPreview &&
            anchorRef.current.visible &&
            anchorRef.current.source !== "groq";
          if (fromPreview && !liveBox) {
            retained = true;
            retainedPhoto.current = resized.uri;
            setPhoto({ ...resized, format: "jpg" });
          }
          const box =
            result.bbox && preview.height
              ? projectDish(
                  normalizedBoxToDetection(result.bbox),
                  resized,
                  preview,
                  false,
                )
              : null;
          if (!liveBox) {
            if (box) showAnchor({ ...box, source: "groq" });
            else hideAnchor();
          }
        } else {
          setNoFood(true);
          void playFeedback("error");
          if (!quiet)
            setError(
              "No meal was identified. Retake the photo or enter the dish yourself.",
            );
          hideAnchor();
        }
      }
    } catch (cause) {
      if (mounted.current && generation.current === current && !quiet) {
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
      if (upload && !retained) deleteScanImage(upload.uri);
      if (mounted.current && generation.current === current) {
        setIdentifying(false);
        request.current = null;
      }
    }
  }
  async function scanCapture(quiet: boolean) {
    if (!camera.current || capturing.current || request.current) return;
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
        await identify(image, quiet, true);
    } catch {
      if (!quiet && mounted.current && current === generation.current)
        setError(
          "Live scan failed. Take a photo or restart Live scan to retry.",
        );
    } finally {
      if (image) deleteScanImage(image.uri);
      capturing.current = false;
    }
  }
  async function scanPreview() {
    if (!camera.current || capturing.current || scanned.current) return;
    scanned.current = true;
    await scanCapture(false);
  }
  const autoSnap = useEffectEvent(() => void scanPreview());
  const fallbackProbe = useEffectEvent(() => void scanCapture(true));
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
  // YOLO-miss contingency: when tracking cannot see food (frames keep coming
  // back invisible), let Groq identify AND approximately locate it from a full
  // frame. An estimate is only rendered on the captured frame it describes —
  // never as a live-tracked box.
  useEffect(() => {
    const now = Date.now();
    const eligible =
      live &&
      !photo &&
      ready &&
      active &&
      !busy &&
      !identifying &&
      !catching &&
      !recognition &&
      !error &&
      !anchor.visible &&
      fallbackLeft.current > 0 &&
      trackingActive.current;
    if (!eligible) {
      fallbackMissing.current = 0;
      return;
    }
    if (!fallbackMissing.current) fallbackMissing.current = now;
    const due = Math.max(
      fallbackMissing.current + FALLBACK_DEBOUNCE_MS,
      fallbackLast.current + FALLBACK_COOLDOWN_MS,
    );
    const timer = setTimeout(
      () => {
        if (request.current || capturing.current) return;
        fallbackMissing.current = 0;
        fallbackLast.current = Date.now();
        fallbackLeft.current -= 1;
        fallbackProbe();
      },
      Math.max(0, due - now),
    );
    return () => clearTimeout(timer);
  }, [
    anchor,
    live,
    photo,
    ready,
    active,
    busy,
    identifying,
    catching,
    recognition,
    error,
  ]);

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
      // Localize the captured image itself; live preview coordinates may
      // describe a different frame or crop.
      hideAnchor();
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
    retainedPhoto.current = null;
    setReady(false);
    setAttempt((value) => value + 1);
    setPhoto(null);
    delivered.current = false;
    setNoFood(false);
    scanned.current = false;
    setRecognition(null);
    setIdentifying(false);
    hideAnchor();
    fallbackLeft.current = FALLBACK_MAX_ATTEMPTS;
    fallbackLast.current = 0;
    fallbackMissing.current = 0;
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
            onTracking={(bounds) => {
              trackingActive.current = true;
              if (bounds.visible) setNoFood(false);
              if (!bounds.visible && anchorRef.current.visible && recognition) {
                setRecognition(null);
                scanned.current = false;
              }
              anchorRef.current = bounds;
              setAnchor(bounds);
            }}
            onTrackingError={(message) => {
              trackingActive.current = false;
              setTrackingError(message);
            }}
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
      {foodInFrame && (
        <DishOverlay
          key={`${facing}-${attempt}-${live}`}
          preview={preview}
          anchor={noFood ? { ...anchor, visible: false } : anchor}
          scanning={live && !photo && !recognition}
          analyzing={!!photo && identifying}
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
      {showWarning && !showInfo && (
        <View
          accessibilityLiveRegion="polite"
          style={[s.errorRow, s.warning, { top: insets.top + 76 }]}
        >
          <Text style={s.error}>{warning}</Text>
          {!!error && !ready && !photo && permission?.granted && (
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss recognition warning"
            onPress={() => setDismissedWarning(warning)}
            style={({ pressed }) => [s.dismissWarning, pressed && s.pressed]}
          >
            {icon("close-outline", 20)}
          </Pressable>
        </View>
      )}
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
            Live scan uploads a snapshot to our recognition service, powered by
            Groq. Keep one dish in frame, then take a photo to review it. Save
            your discovery to earn rewards. You can also take a photo, choose
            one from your library, or enter a dish manually.
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
              request.current = null;
              fallbackLeft.current = FALLBACK_MAX_ATTEMPTS;
              fallbackLast.current = 0;
              fallbackMissing.current = 0;
              scanned.current = false;
              setTrackingError("");
              hideAnchor();
              setNoFood(false);
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
        <View style={s.photoActions}>
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
          {(noFood || !!error) && !identifying && !busy && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter dish manually"
              onPress={() => deliverCapture(true)}
              style={({ pressed }) => [s.round, pressed && s.pressed]}
            >
              {icon("create-outline", 20)}
            </Pressable>
          )}
        </View>

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
                generation.current++;
                request.current?.abort();
                request.current = null;
                setIdentifying(false);
                setReady(false);
                setFacing((value) => (value === "back" ? "front" : "back"));
                scanned.current = false;
                setTrackingError("");
                hideAnchor();
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
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  warning: {
    position: "absolute",
    left: 20,
    right: 20,
  },
  dismissWarning: {
    width: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
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
