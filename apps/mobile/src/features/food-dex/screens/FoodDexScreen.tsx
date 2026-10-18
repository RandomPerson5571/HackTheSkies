import { useMenuSound } from "../../../hooks/useMenuSound";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { CiboLogo } from "../../../components/CiboLogo";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cuisineCovers,
  findCatalogDish,
  cuisineRegions,
  normalizeCuisine,
  cuisines,
  dishes,
  dishNumber,
  foodKey,
  type Cuisine,
  type FoodEntry,
} from "../models/foodDex";
import { CatalogPhoto } from "../components/CatalogPhoto";
import { DiscoveryCard } from "../components/DiscoveryCard";
import {
  DiscoveryReveal,
  type DiscoveryMoment,
} from "../components/DiscoveryReveal";
import { CulinaryAtlas } from "../components/CulinaryAtlas";
import { CollectionProgress } from "../components/CollectionProgress";
import { collectionProgress, cardTier, nextDiscoveryMilestone, cuisineMastery, cuisineMasteryTarget } from "../models/discovery";
import { playFeedback } from "../../../lib/sensory";
import { catalogPhoto } from "../services/catalogPhotos";
import { recognizeFood, type FoodRecognition } from "../services/foodScanner";
import type { useFoodDex } from "../hooks/useFoodDex";
import { colors } from "../../../theme/index";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
function Icon({
  name,
  size = 22,
  color = colors.accent,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}
function Button({
  title,
  icon,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  icon: IconName;
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
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && s.dim,
      ]}
    >
      <Icon
        name={icon}
        color={secondary ? colors.accent : colors.white}
        size={20}
      />
      <Text style={[s.buttonText, secondary && { color: colors.accent }]}>
        {title}
      </Text>
    </Pressable>
  );
}

export type FoodCapture = {
  recognition?: FoodRecognition | null;
  id: number;
  photo: ImagePicker.ImagePickerAsset | null;
  error: string;
};

export function FoodDexScreen({
  capture = null,
  onOpenCamera,
  dex,
  onOpenQuests,
  onDiscover,
}: {
  dex: ReturnType<typeof useFoodDex>;
  capture?: FoodCapture | null;
  onOpenCamera?: () => void;
  onOpenQuests?: () => void;
  onDiscover?: (cuisine: Cuisine) => void;
}) {
  const insets = useSafeAreaInsets();
  const { entries, error: storageError, discover, remove } = dex;
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [filter, setFilter] = useState<"all" | "collected" | "untried">("all");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [scanOpen, setScanOpen] = useState(Boolean(capture));  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(
    capture?.photo ?? null,
  );
  const [name, setName] = useState(capture?.recognition?.name ?? "");
  const [scanCuisine, setScanCuisine] = useState<Cuisine>(
    capture?.recognition?.cuisine ?? "Other",
  );
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [scanError, setScanError] = useState(capture?.error ?? "");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<FoodEntry | null>(null);
  const [moment, setMoment] = useState<DiscoveryMoment | null>(null);
  const [view, setView] = useState<"collection" | "atlas">("collection");
  const [detailView, setDetailView] = useState<"grid" | "list">("grid");
  const [atlasFocus, setAtlasFocus] = useState<Cuisine | null>(null);
  useMenuSound(scanOpen);
  useMenuSound(detail !== null);
  useMenuSound(cuisine !== null);

  const request = useRef<AbortController | null>(null);
  const pickerActive = useRef(false);
  const session = useRef(0);
  useEffect(
    () => () => {
      session.current++;
      request.current?.abort();
    },
    [],
  );

  function closeScan() {
    session.current++;
    request.current?.abort();
    request.current = null;
    setBusy(false);
    setScanOpen(false);
  }
  function openScan(dishName = "", dishCuisine: Cuisine = cuisine ?? "Other") {
    session.current++;
    setPhoto(null);
    setName(dishName);
    setScanCuisine(dishCuisine);
    setScanError("");
    setNotice("");
    setScanOpen(true);
  }
  async function pickPhoto() {
    if (pickerActive.current) return;
    pickerActive.current = true;
    setPicking(true);
    setScanError("");
    const currentSession = session.current;
    request.current?.abort();
    setBusy(false);
    try {
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        base64: true,
        quality: 0.5,
        allowsEditing: true,
        aspect: [1, 1],
      };
      const result = await ImagePicker.launchImageLibraryAsync(options);
      if (
        currentSession !== session.current ||
        result.canceled ||
        !result.assets[0]
      )
        return;
      setPhoto(result.assets[0]);
      setName("");
      setScanCuisine(cuisine ?? "Other");
    } catch {
      if (currentSession === session.current)
        setScanError(
          "Couldn’t open your camera or photos. Try the other option or add the dish by hand.",
        );
    } finally {
      pickerActive.current = false;
      setPicking(false);
    }
  }
  async function analyze() {
    if (!photo?.base64 || busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setScanError("");
    const timeout = setTimeout(() => controller.abort(), 30_000);
    const currentSession = session.current;
    try {
      const result = await recognizeFood(photo.base64, controller.signal);
      if (currentSession !== session.current) return;
      if (result) {
        setName(result.name);
        setScanCuisine(normalizeCuisine(result.cuisine) ?? "Other");
      } else
        setScanError(
          "No dish was identified in this photo. Try another photo or enter the food below.",
        );
    } catch (error) {
      if (currentSession === session.current)
        setScanError(
          controller.signal.aborted
            ? "The scan timed out. Try again or enter the food below."
            : error instanceof Error
              ? error.message
              : "Couldn’t scan this photo. You can enter the food below.",
        );
    } finally {
      clearTimeout(timeout);
      if (currentSession === session.current) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  function save() {
    if (!name.trim() || busy) return;
    const photoUri =
      Platform.OS === "web" && photo?.base64
        ? `data:image/jpeg;base64,${photo.base64}`
        : (photo?.uri ?? "");
    if (!discover(name.trim(), scanCuisine, photoUri)) {
      setScanError(
        `${name.trim()} is already in your ${scanCuisine} collection.`,
      );
      return;
    }
    onDiscover?.(scanCuisine);
    setMoment({
      entry: {
        id: `reveal-${Date.now()}`,
        name: name.trim(),
        cuisine: scanCuisine,
        photo: photoUri,
        discoveredAt: new Date().toISOString(),
      },
      before: entries,
    });
    const newCuisine = !entries.some((entry) => entry.cuisine === scanCuisine);
    void playFeedback(newCuisine ? "sparkle" : "discover");
    setNotice("");
    closeScan();
  }

  const cuisinesExplored = new Set(entries.map((entry) => entry.cuisine)).size;
  const progress = collectionProgress(entries);
  const collectionForCuisine = entries.filter(
    (entry) => entry.cuisine === cuisine,
  );
  const targets = dishes.filter((dish) => dish.cuisine === cuisine);
  const targetKeys = new Set(
    targets.map((dish) => foodKey(dish.name, dish.cuisine)),
  );
  const rows = [
    ...targets.map((dish) => ({
      ...dish,
      catalogDish: dish,
      entry: entries.find(
        (entry) =>
          foodKey(entry.name, entry.cuisine) ===
          foodKey(dish.name, dish.cuisine),
      ),
    })),
    ...collectionForCuisine
      .filter((entry) => !targetKeys.has(foodKey(entry.name, entry.cuisine)))
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        cuisine: entry.cuisine,
        note: "A discovery of your own.",
        catalogDish: undefined,
        entry,
      })),
  ].filter(
    (dish) =>
      (filter === "all" ||
      (filter === "collected" && !!dish.entry) ||
      (filter === "untried" && !dish.entry)) &&
      dish.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <View style={s.screen}>
      <ScrollView
        contentContainerStyle={[
          s.content,
          { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 110 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.brandHeader}>
          <CiboLogo />
          <View style={s.brand}>
            <Icon name="book-outline" size={26} />
          </View>
        </View>
        <View style={s.heading}>
          <View style={s.flex}>
            <Text style={s.eyebrow}>ONE BITE AT A TIME</Text>
            <Text style={s.title}>Your Food Dex.</Text>
            <Text style={s.copy}>A little curiosity. A world of flavor.</Text>
          </View>
        </View>
        {onOpenQuests && (
          <Button title="Continue my cuisine quests" icon="flag-outline" onPress={onOpenQuests} secondary />
        )}
        <View style={s.viewTabs}>
          {(["collection", "atlas"] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === item }}
              onPress={() => setView(item)}
              style={({ pressed }) => [
                s.viewTab,
                view === item && s.viewTabActive,
                pressed && s.dim,
              ]}
            >
              <Icon
                name={
                  item === "collection" ? "albums-outline" : "earth-outline"
                }
                color={view === item ? colors.white : colors.ink}
                size={18}
              />
              <Text style={[s.viewTabText, view === item && s.white]}>
                {item === "collection" ? "Collection" : "Culinary atlas"}
              </Text>
            </Pressable>
          ))}
        </View>
        {storageError ? (
          <Text accessibilityRole="alert" style={s.error}>
            {storageError}
          </Text>
        ) : null}
        {view === "atlas" ? (
          <CulinaryAtlas
            key={atlasFocus ?? "atlas"}
            entries={entries}
            focusCuisine={atlasFocus}
            onExplore={(item) => {
              setCuisine(item);
              setFilter("all");
              setQuery("");
            }}
          />
        ) : (
          <>
            <View style={s.collectionCard}>
              <View style={s.row}>
                <View style={s.flex}>
                  <Text style={s.heroEyebrow}>YOUR COLLECTION</Text>
                  <Text style={s.heroTitle}>
                    {entries.length === 0
                      ? "Every bite is a first."
                      : `${entries.length} ${entries.length === 1 ? "discovery" : "discoveries"}`}
                  </Text>
                </View>
                <View style={s.brand}>
                  <Icon name="sparkles-outline" color={colors.white} size={22} />
                </View>
              </View>
              <Text style={s.heroCopy}>
                {entries.length === 0
                  ? "Scan something delicious to start your collection."
                  : `${cuisinesExplored} ${cuisinesExplored === 1 ? "cuisine" : "cuisines"} explored. What will you try next?`}
              </Text>
              <View style={s.milestoneRow}>
                <View style={s.flex}>
                  <Text style={s.milestoneLabel}>
                    Next reward: {nextDiscoveryMilestone(entries.length).label}
                  </Text>
                  <Text style={s.milestoneCount}>
                    {nextDiscoveryMilestone(entries.length).current} /{" "}
                    {nextDiscoveryMilestone(entries.length).target}
                  </Text>
                </View>
              </View>
              <CollectionProgress
                value={nextDiscoveryMilestone(entries.length).fraction}
                color={colors.tint}
                trackColor={colors.border}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => openScan()}
                style={({ pressed }) => [s.heroButton, pressed && s.dim]}
              >
                <Icon name="scan-outline" />
                <Text style={s.heroButtonText}>Discover a new dish</Text>
                <Icon name="arrow-forward" size={18} />
              </Pressable>
              <Text style={s.meta}>
                Catalog dishes: {progress.collected} / {progress.total} ·{" "}
                {cuisinesExplored} cuisines explored
              </Text>
            </View>
            {notice ? (
              <View accessibilityLiveRegion="polite" style={s.notice}>
                <Icon name="checkmark-circle-outline" />
                <Text style={[s.copy, s.flex]}>{notice}</Text>
              </View>
            ) : null}
            <View style={s.row}>
              <Text style={s.sectionTitle}>Explore by cuisine</Text>
              <Text style={s.meta}>{cuisinesExplored} explored</Text>
            </View>
            <Text style={s.copy}>
              {dishes.length} dishes across {cuisines.length} cuisine
              collections. Find your next favorite.
            </Text>
            <View style={s.grid}>
              {cuisines.map((item) => {
                const catalog = dishes.filter((dish) => dish.cuisine === item);
                const collected = entries.filter(
                  (entry) => entry.cuisine === item,
                );
                const unlocked = catalog.filter((dish) =>
                  collected.some(
                    (entry) =>
                      foodKey(entry.name, item) === foodKey(dish.name, item),
                  ),
                ).length;
                return (
                  <View key={item} style={s.cuisineCard}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${item}, ${collected.length} collected, ${unlocked} of ${catalog.length} dishes discovered`}
                      onPress={() => {
                        setCuisine(item);
                        setFilter("all");
                        setQuery("");
                      }}
                      style={({ pressed }) => [pressed && s.dim]}
                    >
                      <CatalogPhoto
                        source={catalogPhoto(cuisineCovers[item])}
                        style={s.cuisineImage}
                        label={
                          cuisineCovers[item]
                            ? `${item} cuisine: ${cuisineCovers[item].name}`
                            : "Other cuisines"
                        }
                      />
                      <View style={s.cardBody}>
                        <View style={s.row}>
                          <Text style={[s.cardTitle, s.flex]}>{item}</Text>
                          <Icon name="chevron-forward" size={16} />
                        </View>
                        <Text style={s.meta}>
                          {collected.length
                            ? `${unlocked} / ${catalog.length} dishes`
                            : "Start collecting"}
                        </Text>
                        <CollectionProgress
                          value={catalog.length ? unlocked / catalog.length : 0}
                        />
                        <Text style={s.progressText}>
                          {(() => {
                            const mastery = cuisineMastery(unlocked, catalog.length);
                            const target = cuisineMasteryTarget(unlocked, catalog.length);
                            if (mastery) return `${mastery} badge earned`;
                            if (catalog.length)
                              return `Collect ${target.target} for ${target.label}`;
                            return "Your own discoveries";
                          })()}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <View style={s.row}>
              <Text style={s.sectionTitle}>Latest discoveries</Text>
              <Icon name="time-outline" size={20} />
            </View>
            {entries.length === 0 ? (
              <View style={s.empty}>
                <View style={s.brand}>
                  <Icon name="restaurant-outline" size={26} />
                </View>
                <Text style={s.cardTitle}>Your first bite belongs here.</Text>
                <Text style={[s.copy, s.center]}>
                  Snap your meal or add a dish you’ve tried. Every discovery
                  becomes part of your story.
                </Text>
                <Button
                  title="Add your first food"
                  icon="add-outline"
                  onPress={() => openScan()}
                  secondary
                />
              </View>
            ) : (
              entries.slice(0, 6).map((entry) => (
                <Pressable
                  key={entry.id}
                  accessibilityRole="button"
                  onPress={() => setDetail(entry)}
                  style={({ pressed }) => [s.discovery, pressed && s.dim]}
                >
                  <CatalogPhoto
                    source={
                      entry.photo
                        ? { uri: entry.photo }
                        : catalogPhoto(
                            findCatalogDish(entry.name, entry.cuisine),
                          )
                    }
                    style={s.thumbnail}
                    label={entry.name}
                  />
                  <View style={s.flex}>
                    <Text style={s.cardTitle}>{entry.name}</Text>
                    <Text style={s.meta}>
                      {entry.cuisine} ·{" "}
                      {new Date(entry.discoveredAt).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                        },
                      )}
                    </Text>
                  </View>
                  <Text style={s.rarityLabel}>
                    {cardTier(entry.name, entry.cuisine)}
                  </Text>
                  <Icon name="chevron-forward" size={18} />
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      <Modal
        visible={
          cuisine !== null || scanOpen || detail !== null || moment !== null
        }
        transparent
        animationType="none"
        onRequestClose={() => {
          if (moment) setMoment(null);
          else if (detail) setDetail(null);
          else if (scanOpen) closeScan();
          else setCuisine(null);
        }}
      >
        {moment ? (
          <DiscoveryReveal
            moment={moment}
            entries={entries}
            onClose={() => setMoment(null)}
            onAtlas={() => {
              setAtlasFocus(moment.entry.cuisine);
              setView("atlas");
              setCuisine(null);
              setMoment(null);
            }}
          />
        ) : detail !== null ? (
          <View style={s.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Close discovery"
              onPress={() => setDetail(null)}
            />
            <ScrollView
              accessibilityViewIsModal
              style={s.cardDetailSheet}
              contentContainerStyle={[
                s.detailSheet,
                { paddingBottom: insets.bottom + 24 },
              ]}
            >
              {detail && (
                <>
                  <View style={s.row}>
                    <Text style={[s.eyebrow, s.flex]}>DISCOVERY COLLECTED</Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Close discovery"
                      onPress={() => setDetail(null)}
                      style={s.iconButton}
                    >
                      <Icon name="close" />
                    </Pressable>
                  </View>
                  <DiscoveryCard key={detail.id} entry={detail} onLight />
                  <Button
                    title="Remove from collection"
                    icon="trash-outline"
                    secondary
                    onPress={() => {
                      remove(detail.id);
                      setDetail(null);
                      setNotice(`${detail.name} removed from your collection.`);
                    }}
                  />
                </>
              )}
            </ScrollView>
          </View>
        ) : scanOpen ? (
          <KeyboardAvoidingView
            style={[s.screen, { paddingTop: insets.top }]}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={s.modalHeading}>
              <Text style={[s.sectionTitle, s.flex]}>A new discovery</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close scanner"
                onPress={closeScan}
                style={s.iconButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[
                s.detailContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={s.title}>What’s on your plate?</Text>
              <Text style={s.copy}>Snap it. Name it. Collect it.</Text>
              {photo ? (
                <Image
                  source={{ uri: photo.uri }}
                  style={s.preview}
                  accessibilityLabel="Your food photo"
                />
              ) : (
                <View style={s.viewfinder}>
                  <Icon name="scan-outline" size={64} />
                  <Text style={s.cardTitle}>Every meal has a story.</Text>
                  <Text style={[s.copy, s.center]}>
                    Take a clear photo of one dish, or choose one from your
                    library.
                  </Text>
                </View>
              )}
              <View style={s.photoButtons}>
                <View style={s.flex}>
                  <Button
                    title="Camera"
                    icon="camera-outline"
                    secondary
                    disabled={busy || picking}
                    onPress={() => {
                      closeScan();
                      onOpenCamera?.();
                    }}
                  />
                </View>
                <View style={s.flex}>
                  <Button
                    title="Photos"
                    icon="images-outline"
                    secondary
                    disabled={busy || picking}
                    onPress={() => void pickPhoto()}
                  />
                </View>
              </View>
              {photo && (
                <>
                  <Text style={s.meta}>
                    Analyze photo sends this image to our recognition service,
                    powered by Groq. You can also enter the dish yourself below.
                  </Text>
                  <Button
                    title={busy ? "Identifying your food…" : "Analyze photo"}
                    icon="sparkles-outline"
                    disabled={busy || picking || !photo.base64}
                    onPress={() => void analyze()}
                  />
                </>
              )}
              {busy && (
                <ActivityIndicator
                  color={colors.accent}
                  accessibilityLabel="Identifying food"
                />
              )}
              {scanError ? (
                <Text accessibilityRole="alert" style={s.error}>
                  {scanError}
                </Text>
              ) : null}
              <View style={s.divider} />
              <Text style={s.sectionTitle}>
                {name ? "Confirm your discovery" : "Or add it yourself"}
              </Text>
              <Text style={s.copy}>
                Check the name and cuisine before it joins your Dex.
              </Text>
              <Text style={s.label}>DISH NAME</Text>
              <TextInput
                accessibilityLabel="Dish name"
                placeholder="e.g. Ramen"
                placeholderTextColor={colors.muted}
                value={name}
                editable={!busy}
                maxLength={80}
                onChangeText={setName}
                style={s.field}
              />
              <Text style={s.label}>CUISINE</Text>
              <View style={s.cuisineChips}>
                {cuisines.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{
                      selected: scanCuisine === item,
                      disabled: busy,
                    }}
                    disabled={busy}
                    onPress={() => setScanCuisine(item)}
                    style={({ pressed }) => [
                      s.chip,
                      scanCuisine === item && s.chipActive,
                      pressed && s.dim,
                    ]}
                  >
                    <Text style={[s.chipText, scanCuisine === item && s.white]}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Button
                title="Add to my Food Dex"
                icon="checkmark-outline"
                disabled={!name.trim() || busy || picking}
                onPress={save}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        ) : (
          <View style={[s.screen, { paddingTop: insets.top }]}>
            <View style={s.modalHeading}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to cuisines"
                onPress={() => setCuisine(null)}
                style={s.iconButton}
              >
                <Icon name="arrow-back" />
              </Pressable>
              <View style={s.flex}>
                <Text style={s.sectionTitle}>{cuisine} cuisine</Text>
                <Text style={s.meta}>
                  {collectionForCuisine.length} / {targets.length} collected
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scan food"
                onPress={() => openScan()}
                style={s.iconButton}
              >
                <Icon name="scan-outline" />
              </Pressable>
            </View>
            <FlatList
              key={detailView}
              contentContainerStyle={[
                s.detailContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              keyboardShouldPersistTaps="handled"
              data={rows}
              keyExtractor={(dish) => dish.id}
              numColumns={detailView === "grid" ? 2 : 1}
              columnWrapperStyle={
                detailView === "grid" ? { gap: 12 } : undefined
              }
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={5}
              ListHeaderComponent={
                <View style={s.collectionHeader}>
                  {cuisine && (
                    <>
                      <CatalogPhoto
                        eager
                        source={catalogPhoto(cuisineCovers[cuisine])}
                        style={s.banner}
                        label={
                          cuisineCovers[cuisine]
                            ? `${cuisine}: ${cuisineCovers[cuisine].name}`
                            : "Other cuisines"
                        }
                      />
                    </>
                  )}
                  <Text style={s.title}>A taste of {cuisine}.</Text>
                  {cuisine && cuisineRegions[cuisine].length > 0 && (
                    <Text style={s.copy}>
                      {cuisineRegions[cuisine].join(" · ")}
                    </Text>
                  )}
                  <Text style={s.copy}>
                    {collectionForCuisine.length} collected · {targets.length}{" "}
                    dishes to discover
                  </Text>
                  <Text style={s.meta}>
                    {(() => {
                      const unlocked = targets.filter((dish) =>
                        collectionForCuisine.some(
                          (entry) =>
                            foodKey(entry.name, cuisine!) === foodKey(dish.name, cuisine!),
                        ),
                      ).length;
                      const mastery = cuisineMastery(unlocked, targets.length);
                      const target = cuisineMasteryTarget(unlocked, targets.length);
                      return mastery
                        ? `${mastery} badge earned`
                        : `Collect ${target.target} dishes to earn your ${target.label}`;
                    })()}
                  </Text>
                  {onOpenQuests && (
                    <Pressable
                      accessibilityRole="button"
                      onPress={onOpenQuests}
                      style={({ pressed }) => [s.questButton, pressed && s.dim]}
                    >
                      <Icon name="flag-outline" />
                      <Text style={s.questButtonText}>
                        Start {cuisine} Food Quest
                      </Text>
                      <Icon name="arrow-forward" size={18} />
                    </Pressable>
                  )}
                  <View style={[s.search, searchFocused && s.searchActive]}>
                    <Icon name="search-outline" size={19} />
                    <TextInput
                      accessibilityLabel="Search dishes"
                      placeholder="Search dishes…"
                      placeholderTextColor={colors.muted}
                      value={query}
                      onChangeText={setQuery}
                      onFocus={() => setSearchFocused(true)}
                      onBlur={() => setSearchFocused(false)}
                      style={s.input}
                    />
                  </View>
                  <View style={s.row}>
                    {(["all", "collected", "untried"] as const).map((item) => (
                      <Pressable
                        key={item}
                        accessibilityRole="button"
                        accessibilityState={{ selected: filter === item }}
                        onPress={() => setFilter(item)}
                        style={({ pressed }) => [
                          s.chip,
                          filter === item && s.chipActive,
                          pressed && s.dim,
                        ]}
                      >
                        <Text style={[s.chipText, filter === item && s.white]}>
                          {item === "all"
                            ? "All"
                            : item === "collected"
                              ? "Collected"
                              : "Not tried"}
                        </Text>
                      </Pressable>
                    ))}
                    <View style={s.viewToggle}>
                      {(["grid", "list"] as const).map((item) => (
                        <Pressable
                          key={item}
                          accessibilityRole="button"
                          accessibilityState={{ selected: detailView === item }}
                          onPress={() => setDetailView(item)}
                          style={({ pressed }) => [
                            s.toggleButton,
                            detailView === item && s.toggleButtonActive,
                            pressed && s.dim,
                          ]}
                        >
                          <Icon
                            name={item === "grid" ? "grid-outline" : "list-outline"}
                            size={16}
                            color={detailView === item ? colors.white : colors.ink}
                          />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </View>
              }
              renderItem={({ item: dish }) =>
                detailView === "grid" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${dish.catalogDish ? `number ${dishNumber(dish.catalogDish)}, ` : "custom, "}${dish.name}, ${dish.entry ? "collected, view discovery" : "not collected, add food"}`}
                    onPress={() =>
                      dish.entry
                        ? setDetail(dish.entry)
                        : openScan(dish.name, dish.cuisine)
                    }
                    style={({ pressed }) => [s.dishTile, pressed && s.dim]}
                  >
                    <CatalogPhoto
                      source={
                        dish.entry?.photo
                          ? { uri: dish.entry.photo }
                          : catalogPhoto(dish.catalogDish)
                      }
                      style={s.dishTilePhoto}
                      label={dish.name}
                    />
                    <View style={s.dishTileBody}>
                      <Text style={s.eyebrow}>
                        {dish.catalogDish
                          ? `#${String(dishNumber(dish.catalogDish)).padStart(3, "0")}`
                          : "CUSTOM"}
                      </Text>
                      <Text style={s.cardTitle} numberOfLines={2}>
                        {dish.name}
                      </Text>
                      <Text
                        style={[
                          s.meta,
                          dish.entry ? s.collectedText : s.undiscoveredText,
                        ]}
                      >
                        {dish.entry ? "Collected" : "Not tried"}
                      </Text>
                    </View>
                    {dish.entry && (
                      <View style={s.tileBadge}>
                        <Icon name="checkmark-circle" size={18} />
                      </View>
                    )}
                  </Pressable>
                ) : (
                  <View key={dish.id} style={s.dishGroup}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${dish.catalogDish ? `number ${dishNumber(dish.catalogDish)}, ` : "custom, "}${dish.name}, ${dish.entry ? "collected, view discovery" : "not collected, add food"}`}
                      onPress={() =>
                        dish.entry
                          ? setDetail(dish.entry)
                          : openScan(dish.name, dish.cuisine)
                      }
                      style={({ pressed }) => [s.dish, pressed && s.dim]}
                    >
                      <CatalogPhoto
                        source={
                          dish.entry?.photo
                            ? { uri: dish.entry.photo }
                            : catalogPhoto(dish.catalogDish)
                        }
                        style={s.dishPhoto}
                        label={dish.name}
                      />
                      <View style={s.flex}>
                        <Text style={s.eyebrow}>
                          {dish.catalogDish
                            ? `#${String(dishNumber(dish.catalogDish)).padStart(3, "0")}`
                            : "CUSTOM"}{" "}
                          · {dish.entry ? "COLLECTED" : "UNDISCOVERED"}
                        </Text>
                        <Text style={s.cardTitle}>{dish.name}</Text>
                        <Text style={s.meta}>{dish.note}</Text>
                      </View>
                      <Icon
                        name={dish.entry ? "checkmark-circle" : "add-outline"}
                        size={20}
                      />
                    </Pressable>
                  </View>
                )
              }
              ListEmptyComponent={
                <View style={s.empty}>
                  <Text style={s.cardTitle}>
                    {query ? "No dishes found" : "A new adventure awaits"}
                  </Text>
                  <Text style={[s.copy, s.center]}>
                    {query
                      ? "Try another dish name."
                      : "Scan or add your first food from this cuisine."}
                  </Text>
                </View>
              }
              ListFooterComponent={
                <Button
                  title="Add a discovery"
                  icon="add-outline"
                  onPress={() => openScan()}
                />
              }
            />
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  viewTabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 28,
    backgroundColor: colors.border,
    gap: 4,
  },
  viewTab: {
    flex: 1,
    minHeight: 44,
    padding: 10,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewTabActive: { backgroundColor: colors.accent },
  viewTabText: { color: colors.ink, fontWeight: "600", fontSize: 12 },
  rarityLabel: { color: colors.accent, fontSize: 10, fontWeight: "700" },
  cardDetailSheet: {
    maxHeight: "90%",
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 20,
    gap: 16,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  flex: { flex: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "space-between",
  },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: "700",
    color: colors.muted,
  },
  title: {
    fontSize: 30,
    letterSpacing: -1,
    fontWeight: "700",
    color: colors.ink,
  },
  copy: { fontSize: 14, lineHeight: 21, color: colors.muted },
  brand: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    padding: 22,
    gap: 16,
    backgroundColor: colors.accent,
    borderRadius: 26,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.3,
    color: colors.white,
  },
  heroTitle: {
    color: colors.white,
    fontSize: 25,
    fontWeight: "600",
    letterSpacing: -0.7,
    marginTop: 8,
  },
  heroCopy: { color: colors.white, fontSize: 14, lineHeight: 21 },
  heroButton: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  heroButtonText: {
    flex: 1,
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "600",
    letterSpacing: -0.4,
  },
  meta: { fontSize: 12, lineHeight: 18, color: colors.muted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cuisineCard: {
    width: "48%",
    flexGrow: 1,
    flexBasis: "45%",
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  cuisineImage: { width: "100%", height: 116, backgroundColor: colors.tint },
  dishPhoto: {
    width: 72,
    height: 72,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  cardBody: { padding: 14, gap: 6 },
  cardTitle: { color: colors.ink, fontSize: 16, fontWeight: "600" },
  track: {
    height: 5,
    backgroundColor: colors.tint,
    borderRadius: 4,
    marginTop: 6,
    overflow: "hidden",
  },
  fill: { height: "100%", backgroundColor: colors.accent, borderRadius: 4 },
  progressText: { fontSize: 10, color: colors.muted },
  empty: {
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    alignItems: "center",
    gap: 12,
  },
  center: { textAlign: "center" },
  dim: { opacity: 0.5 },
  button: {
    minHeight: 50,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.accent,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: colors.tint },
  buttonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "600",
    flexShrink: 1,
  },
  discovery: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.white,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  notice: {
    padding: 14,
    backgroundColor: colors.tint,
    borderRadius: 16,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },
  error: {
    color: colors.ink,
    backgroundColor: colors.tint,
    padding: 14,
    borderRadius: 14,
    fontSize: 13,
    lineHeight: 20,
  },
  modalHeading: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  collectionHeader: { gap: 16 },
  detailContent: {
    padding: 20,
    gap: 16,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  banner: {
    height: 180,
    width: "100%",
    borderRadius: 20,
    backgroundColor: colors.tint,
  },
  search: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  searchActive: {
    borderColor: colors.accent,
    backgroundColor: colors.tint,
  },
  input: { flex: 1, minHeight: 50, color: colors.ink, fontSize: 14 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  white: { color: colors.white },
  dishGroup: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 4,
  },
  dish: {
    paddingVertical: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderColor: colors.border,
  },
  preview: {
    height: 240,
    width: "100%",
    borderRadius: 24,
    backgroundColor: colors.tint,
  },
  viewfinder: {
    minHeight: 240,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accent,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    backgroundColor: colors.tint,
  },
  photoButtons: { flexDirection: "row", gap: 12 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },
  label: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.muted,
  },
  field: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    borderRadius: 16,
    minHeight: 52,
    padding: 14,
    color: colors.ink,
    fontSize: 16,
  },
  cuisineChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  collectionCard: {
    padding: 20,
    gap: 12,
    backgroundColor: colors.accent,
    borderRadius: 24,
  },
  milestoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  milestoneLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "600",
  },
  milestoneCount: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "700",
  },
  questButton: {
    backgroundColor: colors.paper,
    borderRadius: 16,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
  },
  questButtonText: {
    flex: 1,
    color: colors.accent,
    fontSize: 14,
    fontWeight: "700",
  },
  viewToggle: {
    flexDirection: "row",
    gap: 4,
    marginLeft: "auto",
  },
  toggleButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleButtonActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  dishTile: {
    flex: 1,
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    marginBottom: 12,
  },
  dishTilePhoto: {
    width: "100%",
    height: 120,
    backgroundColor: colors.tint,
  },
  dishTileBody: {
    padding: 12,
    gap: 4,
  },
  tileBadge: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  collectedText: { color: colors.accent, fontWeight: "600" },
  undiscoveredText: { color: colors.muted },
    overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#3D568F99",
  },
  detailSheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 16,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
});
