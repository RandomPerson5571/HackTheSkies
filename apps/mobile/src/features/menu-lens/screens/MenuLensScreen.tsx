import { useMenuSound } from "../../../hooks/useMenuSound";
import { playFeedback } from "../../../lib/sensory";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { CameraCapturedPicture } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, cameraColors } from "../../../theme";
import type { Profile } from "../../profile/models/profile";
import { useFoodDex } from "../../food-dex/hooks/useFoodDex";
import { catalogPhoto } from "../../food-dex/services/catalogPhotos";
import {
  resizeScanImage,
  deleteScanImage,
} from "../../food-dex/services/scanImages";
import {
  containMenuBox,
  menuDiscovery,
  sampleMenu,
  type MenuDish,
} from "../models/menuLens";
import { scanMenu } from "../services/menuScanner";

type Photo = {
  uri: string;
  width: number;
  height: number;
  base64?: string | null;
};
type Icon = React.ComponentProps<typeof Ionicons>["name"];
const badgeColors = {
  new: "#EAF3B2",
  collected: "#C4E4FF",
  rare: "#E5D5FF",
  warning: "#FFE0AC",
};
function Action({
  label,
  icon,
  onPress,
  disabled = false,
  primary = false,
}: {
  label: string;
  icon: Icon;
  onPress: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        primary && styles.primaryAction,
        (pressed || disabled) && styles.dim,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={primary ? colors.white : colors.ink}
        accessible={false}
      />
      <Text style={[styles.actionLabel, primary && styles.onDarkLabel]}>
        {label}
      </Text>
    </Pressable>
  );
}

export function MenuLensScreen({
  diet,
  onClose,
  onOpenCamera,
  initialPhoto,
}: {
  diet: Profile["diet"];
  onClose: () => void;
  onOpenCamera: () => void;
  initialPhoto?: CameraCapturedPicture | null;
}) {
  const insets = useSafeAreaInsets();
  const [photo, setPhoto] = useState<Photo | null>(null);
  const photoRef = useRef<Photo | null>(null);
  const [demo, setDemo] = useState(false);
  const [results, setResults] = useState<MenuDish[]>([]);
  const [selected, setSelected] = useState<MenuDish | null>(null);
  useMenuSound(selected !== null);

  const [failedPhotoId, setFailedPhotoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(!!initialPhoto);
  const [error, setError] = useState("");
  useEffect(() => {
    if (error) void playFeedback("error");
  }, [error]);
  const [scanned, setScanned] = useState(false);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const generation = useRef(0);
  const locked = useRef(false);
  const request = useRef<AbortController | null>(null);
  const { entries, discover, error: storageError } = useFoodDex();
  const detail = selected ? menuDiscovery(selected, entries, diet) : null;
  const detailPhoto =
    selected?.id === failedPhotoId ? undefined : catalogPhoto(detail?.catalog);

  useEffect(() => {
    return () => {
      // This is an operation counter, not a rendered element ref. Invalidate pending work on cleanup.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      request.current?.abort();
      if (photoRef.current) deleteScanImage(photoRef.current.uri);
    };
  }, []);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (selected) setSelected(null);
        else onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose, selected]);

  function reset() {
    generation.current++;
    request.current?.abort();
    locked.current = false;
    setBusy(false);
    setError("");
    setSelected(null);
    setResults([]);
    setDemo(false);
    setScanned(false);
    if (photoRef.current) deleteScanImage(photoRef.current.uri);
    photoRef.current = null;
    setPhoto(null);
  }
  async function analyze(image: Photo, version: number) {
    void playFeedback("scan");
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      if (!image.base64)
        throw new Error(
          "This image could not be prepared. Choose another photo.",
        );
      const dishes = await scanMenu(image.base64, controller.signal);
      if (version === generation.current) {
        setResults(dishes);
        setScanned(true);
        void playFeedback("success");
      }
    } catch (cause) {
      if (version === generation.current)
        setError(
          controller.signal.aborted
            ? "Scanning timed out. Retry or choose a clearer photo."
            : cause instanceof Error
              ? cause.message
              : "Couldn’t scan this menu.",
        );
    } finally {
      clearTimeout(timeout);
      if (version === generation.current) {
        locked.current = false;
        setBusy(false);
        request.current = null;
      }
    }
  }
  async function prepare(image: Photo, version: number) {
    const resized = await resizeScanImage(image, 1800, true);
    if (version !== generation.current) {
      deleteScanImage(resized.uri);
      return;
    }
    if (photoRef.current) deleteScanImage(photoRef.current.uri);
    photoRef.current = resized;
    setPhoto(resized);
    await analyze(resized, version);
  }
  useEffect(() => {
    if (!initialPhoto) return;
    locked.current = true;
    const version = ++generation.current;
    void prepare(initialPhoto, version)
      .catch(() => {
        if (version === generation.current) {
          locked.current = false;
          setBusy(false);
          setError("Couldn’t prepare this menu. Try another photo.");
        }
      })
      .finally(() => deleteScanImage(initialPhoto.uri));
    // Initial captures are immutable; preparation only runs for a new capture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPhoto]);

  async function acquire() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    const version = ++generation.current;
    let raw: Photo | undefined;
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 1,
      });
      if (picked.canceled || !picked.assets[0]) return;
      raw = picked.assets[0];
      if (version !== generation.current) return;
      setDemo(false);
      setResults([]);
      setScanned(false);
      await prepare(raw, version);
    } catch (cause) {
      if (version === generation.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t open this photo. Please retry.",
        );
    } finally {
      if (version === generation.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  function showDemo() {
    reset();
    setDemo(true);
    setResults(sampleMenu);
    setScanned(true);
  }
  function retry() {
    if (!photo || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setScanned(false);
    setResults([]);
    void analyze(photo, ++generation.current);
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Cibo Lens"
          onPress={onClose}
          style={({ pressed }) => [styles.close, pressed && styles.dim]}
        >
          <Ionicons name="arrow-back" size={24} color={colors.ink} />
        </Pressable>
        <View style={styles.flex}>
          <Text style={styles.eyebrow}>A NEW WAY TO EXPLORE</Text>
          <Text style={styles.title}>Cibo Lens</Text>
        </View>
        <Ionicons
          name="scan-outline"
          size={30}
          color={colors.accent}
          accessible={false}
        />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
      >
        <Text style={styles.intro}>A whole menu. A world of discoveries.</Text>
        <Text style={styles.muted}>
          Capture a menu, then tap a dish to uncover its story.
        </Text>
        {photo || demo ? (
          <View
            key="menu"
            style={styles.menuFrame}
            onLayout={(event) => setViewport(event.nativeEvent.layout)}
          >
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={StyleSheet.absoluteFill}
                resizeMode="contain"
                accessibilityLabel="Captured restaurant menu"
              />
            ) : (
              <View style={styles.samplePage}>
                <Text style={styles.sampleTitle}>THE CURIOUS TABLE</Text>
                <Text style={styles.sampleSubtitle}>
                  A little taste of everywhere
                </Text>
                {sampleMenu.map((dish, index) => (
                  <View
                    key={dish.id}
                    style={[
                      styles.sampleDish,
                      { top: `${(0.24 + index * 0.17) * 100}%` },
                    ]}
                  >
                    <Text style={styles.sampleName}>{dish.name}</Text>
                    <Text style={styles.sampleDescription}>
                      {dish.description}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {results.map((dish, index) => {
              const box =
                dish.box &&
                containMenuBox(
                  dish.box,
                  photo ?? { width: viewport.width, height: viewport.height },
                  viewport,
                );
              if (!box) return null;
              const info = menuDiscovery(dish, entries, diet);
              const color = info.conflicts.length
                ? badgeColors.warning
                : info.collected
                  ? badgeColors.collected
                  : info.rare
                    ? badgeColors.rare
                    : badgeColors.new;
              return (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${dish.name}. ${info.conflicts.length ? "Dietary warning. " : ""}${info.collected ? "Collected" : info.rare ? "Rare find" : "New discovery"}. Open dish card.`}
                  onPress={() => setSelected(dish)}
                  style={({ pressed }) => [
                    styles.anchor,
                    {
                      left: box.x,
                      top: box.y,
                      width: box.width,
                      height: box.height,
                      borderColor: color,
                    },
                    pressed && styles.anchorPressed,
                  ]}
                >
                  <View style={[styles.pin, { backgroundColor: color }]}>
                    <Text style={styles.pinText}>
                      {index + 1} ·{" "}
                      {info.conflicts.length
                        ? "DIETARY WARNING"
                        : info.collected
                          ? "COLLECTED"
                          : info.rare
                            ? "RARE FIND"
                            : "NEW DISCOVERY"}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {busy && (
              <View style={styles.scanning}>
                <ActivityIndicator color={colors.tint} />
                <Text style={[styles.actionLabel, styles.onDarkLabel]}>
                  Reading dishes and finding their stories…
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View key="welcome" style={styles.welcome}>
            <View style={styles.lensIcon}>
              <Ionicons
                name="scan-outline"
                size={58}
                color={colors.accent}
                accessible={false}
              />
            </View>
            <Text style={styles.welcomeTitle}>Discover before you order.</Text>
            <Text style={[styles.muted, styles.center]}>
              New flavours, familiar favourites, and the next card in your Food
              Dex.
            </Text>
            <View style={styles.legend}>
              {[
                ["sparkles-outline", "New discovery"],
                ["checkmark-circle-outline", "Collected"],
                ["diamond-outline", "Rare find"],
                ["alert-circle-outline", "Dietary warning"],
              ].map(([icon, label]) => (
                <View key={label} style={styles.legendItem}>
                  <Ionicons
                    name={icon as Icon}
                    size={16}
                    color={colors.accent}
                  />
                  <Text style={styles.legendText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {demo && (
          <Text style={styles.notice}>
            SAMPLE MENU · Example dishes, using your discovery history.
          </Text>
        )}
        {busy && !photo && (
          <ActivityIndicator
            color={colors.accent}
            accessibilityLabel="Preparing menu photo"
          />
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!!storageError && <Text style={styles.error}>{storageError}</Text>}
        <View style={styles.actions}>
          <Action
            label={photo || demo ? "New photo" : "Open camera"}
            icon="camera-outline"
            primary
            disabled={busy}
            onPress={onOpenCamera}
          />
          <Action
            label="Upload menu"
            icon="image-outline"
            disabled={busy}
            onPress={() => void acquire()}
          />
          {photo && !!error && (
            <Action
              label="Retry scan"
              icon="refresh"
              disabled={busy}
              onPress={retry}
            />
          )}
          {busy && (
            <Action
              label="Cancel scan"
              icon="close"
              onPress={() => {
                generation.current++;
                request.current?.abort();
                locked.current = false;
                setBusy(false);
                setError("Scan canceled. Retry when you’re ready.");
              }}
            />
          )}
        </View>
        {!busy && !demo && (
          <Pressable
            accessibilityRole="button"
            onPress={showDemo}
            style={({ pressed }) => [
              styles.sampleButton,
              pressed && styles.dim,
            ]}
          >
            <Text style={styles.sampleLink}>Try a sample menu</Text>
            <Ionicons name="arrow-forward" color={colors.accent} size={16} />
          </Pressable>
        )}
        <Text style={styles.privacy}>
          Scanning sends this menu photo to our AI service. Only captured photos
          are analyzed.
        </Text>
        {scanned && (
          <View style={styles.results}>
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionTitle}>
                {results.length
                  ? `${results.length} dishes to explore`
                  : "No dishes found"}
              </Text>
              <Text style={styles.muted}>{diet}</Text>
            </View>
            <Text style={styles.muted}>
              {results.length
                ? "Tap a marker or choose a dish below. Mark it collected only after you’ve tried it."
                : "Try a closer, well-lit photo with readable dish names."}
            </Text>
            {results.map((dish, index) => {
              const info = menuDiscovery(dish, entries, diet);
              return (
                <Pressable
                  key={dish.id}
                  accessibilityRole="button"
                  onPress={() => setSelected(dish)}
                  style={({ pressed }) => [
                    styles.result,
                    pressed && styles.dim,
                  ]}
                >
                  <Text style={styles.resultNumber}>
                    {String(index + 1).padStart(2, "0")}
                  </Text>
                  <View style={styles.flex}>
                    <Text style={styles.resultName}>{dish.name}</Text>
                    <Text style={styles.muted}>{info.cuisine}</Text>
                    <View style={styles.badges}>
                      <Text
                        style={[
                          styles.badge,
                          {
                            backgroundColor: info.collected
                              ? badgeColors.collected
                              : badgeColors.new,
                          },
                        ]}
                      >
                        {info.collected ? "COLLECTED" : "NEW DISCOVERY"}
                      </Text>
                      {info.rare && (
                        <Text
                          style={[
                            styles.badge,
                            { backgroundColor: badgeColors.rare },
                          ]}
                        >
                          RARE FIND
                        </Text>
                      )}
                      {!!info.conflicts.length && (
                        <Text
                          style={[
                            styles.badge,
                            { backgroundColor: badgeColors.warning },
                          ]}
                        >
                          DIETARY WARNING
                        </Text>
                      )}
                    </View>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.accent}
                  />
                </Pressable>
              );
            })}
            <Text style={styles.privacy}>
              Ingredient flags are suggestions, not allergy checks. Recipes and
              cross-contact vary; verify with staff.
            </Text>
          </View>
        )}
      </ScrollView>
      <Modal
        visible={!!selected}
        transparent
        animationType="none"
        onRequestClose={() => setSelected(null)}
      >
        <View
          style={[
            styles.modalBackdrop,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.card} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.cardContent}>
              <SheetDragHandle onDismiss={() => setSelected(null)} />
              <View style={styles.sectionHeading}>
                <Text style={styles.cardEyebrow}>CIBO · FOOD DEX</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close dish card"
                  onPress={() => setSelected(null)}
                  style={styles.close}
                >
                  <Ionicons name="close" size={24} color={colors.ink} />
                </Pressable>
              </View>
              {detailPhoto ? (
                <Image
                  key={selected?.id}
                  source={detailPhoto}
                  onError={() => setFailedPhotoId(selected?.id ?? null)}
                  style={styles.dishPhoto}
                  resizeMode="cover"
                  accessibilityLabel={`Reference photo of ${detail?.name}`}
                />
              ) : (
                <View style={[styles.dishPhoto, styles.photoPlaceholder]}>
                  <Ionicons
                    name="restaurant-outline"
                    size={52}
                    color={colors.ink}
                  />
                  <Text style={styles.cardMuted}>No catalog photo yet</Text>
                </View>
              )}
              {detailPhoto && (
                <Text style={styles.credit}>
                  Catalog reference · presentation may vary
                  {detail?.catalog?.image?.attribution
                    ? ` · ${detail.catalog.image.attribution}`
                    : ""}
                </Text>
              )}
              <Text style={styles.cardTitle}>{detail?.name}</Text>
              {selected?.name !== detail?.name && (
                <Text style={styles.cardMuted}>
                  On this menu: {selected?.name}
                </Text>
              )}
              <Text style={styles.cardOrigin}>
                {detail?.catalog?.regions.join(" · ") || detail?.cuisine}
              </Text>
              <Text style={styles.cardBody}>
                {detail?.catalog?.note ||
                  selected?.description ||
                  "A new dish to explore. Ask your server for its story."}
              </Text>
              {!!detail?.conflicts.length && (
                <View style={styles.warning}>
                  <Text style={styles.warningTitle}>
                    Possible {diet.toLowerCase()} conflict
                  </Text>
                  <Text style={styles.cardBody}>
                    May contain {detail.conflicts.join(", ")}. Verify
                    ingredients with staff.
                  </Text>
                </View>
              )}
              <Text style={styles.cardMuted}>
                Menu scans cannot confirm ingredients, allergens, or
                cross-contact. Always verify with staff.
              </Text>
              <View style={styles.progressPanel}>
                <Text style={styles.cardEyebrow}>
                  {detail?.cuisine.toUpperCase()} DISCOVERY
                </Text>
                <Text style={styles.progressCount}>
                  {detail?.cuisineCount} discoveries
                </Text>
                <Text style={styles.cardMuted}>
                  {detail?.collected
                    ? "This dish is already in your Food Dex."
                    : detail?.rare
                      ? "A rare find for you: you’ve tried fewer than 2 dishes from this cuisine."
                      : "Your next discovery is waiting."}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={demo || detail?.collected}
                accessibilityState={{ disabled: demo || detail?.collected }}
                onPress={() => {
                  if (detail) discover(detail.name, detail.cuisine, "");
                }}
                style={({ pressed }) => [
                  styles.collect,
                  (pressed || demo || detail?.collected) && styles.dim,
                ]}
              >
                <Ionicons
                  name={
                    detail?.collected
                      ? "checkmark-circle"
                      : "add-circle-outline"
                  }
                  size={22}
                  color="white"
                />
                <Text style={[styles.actionLabel, styles.onDarkLabel]}>
                  {demo
                    ? "Sample card · preview only"
                    : detail?.collected
                      ? "Collected in your Food Dex"
                      : "I tried this · collect dish"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1 },
  dim: { opacity: 0.5 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: colors.accent,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
  },
  title: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  content: {
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  intro: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1,
  },
  muted: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  center: { textAlign: "center" },
  welcome: {
    borderWidth: 1,
    minHeight: 240,
    borderStyle: "dashed",
    borderColor: colors.accent,
    backgroundColor: colors.tint,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    gap: 20,
  },
  lensIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tint,
  },
  welcomeTitle: {
    color: colors.ink,
    fontSize: 16,
    textAlign: "center",
    fontWeight: "700",
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    justifyContent: "center",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { color: colors.ink, fontSize: 11 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  action: {
    flexGrow: 1,
    flexBasis: 140,
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.tint,
  },
  primaryAction: { backgroundColor: colors.accent },
  actionLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  onDarkLabel: { color: cameraColors.foreground },
  sampleButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  sampleLink: { color: colors.accent, fontSize: 14, fontWeight: "600" },
  privacy: { color: colors.muted, fontSize: 11, lineHeight: 17 },
  notice: {
    color: colors.accent,
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 0.7,
  },
  error: {
    color: colors.ink,
    backgroundColor: badgeColors.warning,
    padding: 14,
    borderRadius: 12,
    lineHeight: 20,
  },
  menuFrame: {
    height: 460,
    backgroundColor: colors.tint,
    borderRadius: 18,
    overflow: "hidden",
  },
  samplePage: { ...StyleSheet.absoluteFill, backgroundColor: colors.paper },
  sampleTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 30,
    letterSpacing: 1,
  },
  sampleSubtitle: {
    color: colors.muted,
    fontSize: 12,
    textAlign: "center",
    marginTop: 8,
  },
  sampleDish: {
    position: "absolute",
    left: "10%",
    width: "80%",
    paddingTop: 8,
  },
  sampleName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  sampleDescription: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    paddingTop: 4,
  },
  anchor: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 6,
    backgroundColor: "#3D568F12",
  },
  anchorPressed: { backgroundColor: "#3D568F55" },
  pin: {
    position: "absolute",
    right: -1,
    top: -12,
    paddingHorizontal: 6,
    minWidth: 24,
    minHeight: 24,
    borderBottomLeftRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pinText: { color: "#24324A", fontSize: 11, fontWeight: "800" },
  scanning: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#090C12BB",
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  results: { gap: 14 },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultNumber: { color: colors.accent, fontSize: 18, fontWeight: "700" },
  resultName: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 8 },
  badge: {
    color: "#24324A",
    fontSize: 9,
    fontWeight: "800",
    paddingVertical: 5,
    paddingHorizontal: 7,
    borderRadius: 5,
    overflow: "hidden",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "#090C12DD",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "100%",
    alignSelf: "center",
    backgroundColor: colors.paper,
    borderRadius: 26,
    overflow: "hidden",
  },
  cardContent: { padding: 20, gap: 14 },
  cardEyebrow: {
    color: colors.ink,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "800",
  },
  dishPhoto: { height: 210, width: "100%", borderRadius: 16 },
  photoPlaceholder: {
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  credit: { color: colors.muted, fontSize: 10, lineHeight: 15 },
  cardTitle: {
    color: colors.ink,
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  cardOrigin: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  cardBody: { color: colors.ink, fontSize: 15, lineHeight: 23 },
  cardMuted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  warning: {
    padding: 14,
    gap: 6,
    backgroundColor: badgeColors.warning,
    borderRadius: 12,
  },
  warningTitle: { color: "#61401E", fontSize: 14, fontWeight: "700" },
  progressPanel: {
    padding: 18,
    gap: 8,
    backgroundColor: colors.tint,
    borderRadius: 16,
  },
  progressCount: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  collect: {
    minHeight: 52,
    padding: 14,
    backgroundColor: colors.ink,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
});
