import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cuisineCovers,
  findCatalogDish,
  cuisineRegions,
  normalizeCuisine,
  cuisines,
  dishes,
  foodKey,
  type Cuisine,
  type FoodEntry,
} from "../models/foodDex";
import { CatalogPhoto } from "../components/CatalogPhoto";
import { PhotoCredit } from "../components/PhotoCredit";
import { catalogPhoto } from "../services/catalogPhotos";
import { recognizeFood } from "../services/foodScanner";
import { useFoodDex } from "../hooks/useFoodDex";
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

export function FoodDexScreen() {
  const insets = useSafeAreaInsets();
  const { entries, error: storageError, discover, remove } = useFoodDex();
  const [cuisine, setCuisine] = useState<Cuisine | null>(null);
  const [filter, setFilter] = useState<"all" | "collected">("all");
  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const [photo, setPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [name, setName] = useState("");
  const [scanCuisine, setScanCuisine] = useState<Cuisine>("Other");
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [scanError, setScanError] = useState("");
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<FoodEntry | null>(null);
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
  async function pickPhoto(camera: boolean) {
    if (pickerActive.current) return;
    pickerActive.current = true;
    setPicking(true);
    setScanError("");
    const currentSession = session.current;
    request.current?.abort();
    setBusy(false);
    try {
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          if (session.current === currentSession)
            setScanError(
              "Camera access is off. Enable it in device settings, choose a photo, or add the dish by hand.",
            );
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        base64: true,
        quality: 0.5,
        allowsEditing: true,
        aspect: [1, 1],
      };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
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
    setNotice(`${name.trim()} discovered! Your collection just got tastier.`);
    closeScan();
  }

  const cuisinesExplored = new Set(entries.map((entry) => entry.cuisine)).size;
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
      (filter === "all" || dish.entry) &&
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
        <View style={s.heading}>
          <View style={s.flex}>
            <Text style={s.eyebrow}>ONE BITE AT A TIME</Text>
            <Text style={s.title}>Your Food Dex.</Text>
            <Text style={s.copy}>A little curiosity. A world of flavor.</Text>
          </View>
          <View style={s.brand}>
            <Icon name="book-outline" size={26} />
          </View>
        </View>
        <View style={s.hero}>
          <View style={s.row}>
            <View style={s.flex}>
              <Text style={s.heroEyebrow}>YOUR TASTE ADVENTURE</Text>
              <Text style={s.heroTitle}>
                {entries.length === 0
                  ? "Every bite is a first."
                  : `${entries.length} delicious discoveries.`}
              </Text>
            </View>
            <Icon name="sparkles-outline" color={colors.white} size={30} />
          </View>
          <Text style={s.heroCopy}>
            {entries.length === 0
              ? "Scan something delicious to start your collection."
              : `${cuisinesExplored} ${cuisinesExplored === 1 ? "cuisine" : "cuisines"} explored. What will you try next?`}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => openScan()}
            style={({ pressed }) => [s.heroButton, pressed && s.dim]}
          >
            <Icon name="scan-outline" />
            <Text style={s.heroButtonText}>Scan a new bite</Text>
            <Icon name="arrow-forward" size={18} />
          </Pressable>
        </View>
        {notice ? (
          <View accessibilityLiveRegion="polite" style={s.notice}>
            <Icon name="checkmark-circle-outline" />
            <Text style={[s.copy, s.flex]}>{notice}</Text>
          </View>
        ) : null}
        {storageError ? (
          <Text accessibilityRole="alert" style={s.error}>
            {storageError}
          </Text>
        ) : null}
        <View style={s.row}>
          <Text style={s.sectionTitle}>Explore by cuisine</Text>
          <Text style={s.meta}>{cuisinesExplored} explored</Text>
        </View>
        <Text style={s.copy}>
          {dishes.length} dishes across {cuisines.length} cuisine collections.
          Find your next favorite.
        </Text>
        <View style={s.grid}>
          {cuisines.map((item) => {
            const catalog = dishes.filter((dish) => dish.cuisine === item);
            const collected = entries.filter((entry) => entry.cuisine === item);
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
                        ? `${collected.length} collected`
                        : "Ready to discover"}
                    </Text>
                    <View style={s.track}>
                      <View
                        style={[
                          s.fill,
                          {
                            width: `${catalog.length ? (unlocked / catalog.length) * 100 : 0}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={s.progressText}>
                      {catalog.length
                        ? `${unlocked} / ${catalog.length} dishes`
                        : "Your own discoveries"}
                    </Text>
                  </View>
                </Pressable>
                <PhotoCredit dish={cuisineCovers[item]} />
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
              Snap your meal or add a dish you’ve tried. Every discovery becomes
              part of your story.
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
                    : catalogPhoto(findCatalogDish(entry.name, entry.cuisine))
                }
                style={s.thumbnail}
                label={entry.name}
              />
              <View style={s.flex}>
                <Text style={s.cardTitle}>{entry.name}</Text>
                <Text style={s.meta}>
                  {entry.cuisine} ·{" "}
                  {new Date(entry.discoveredAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              </View>
              <Icon name="checkmark-circle" />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal
        visible={cuisine !== null || scanOpen || detail !== null}
        transparent
        animationType="none"
        onRequestClose={() => {
          if (detail) setDetail(null);
          else if (scanOpen) closeScan();
          else setCuisine(null);
        }}
      >
        {detail !== null ? (
          <View style={s.overlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="Close discovery"
              onPress={() => setDetail(null)}
            />
            <View
              accessibilityViewIsModal
              style={[s.detailSheet, { paddingBottom: insets.bottom + 24 }]}
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
                  <CatalogPhoto
                    source={
                      detail.photo
                        ? { uri: detail.photo }
                        : catalogPhoto(
                            findCatalogDish(detail.name, detail.cuisine),
                          )
                    }
                    style={s.banner}
                    label={detail.name}
                  />
                  {!detail.photo && (
                    <PhotoCredit
                      dish={findCatalogDish(detail.name, detail.cuisine)}
                    />
                  )}
                  <Text style={s.title}>{detail.name}</Text>
                  <Text style={s.copy}>
                    {detail.cuisine} · Discovered{" "}
                    {new Date(detail.discoveredAt).toLocaleDateString()}
                  </Text>
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
            </View>
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
                    onPress={() => void pickPhoto(true)}
                  />
                </View>
                <View style={s.flex}>
                  <Button
                    title="Photos"
                    icon="images-outline"
                    secondary
                    disabled={busy || picking}
                    onPress={() => void pickPhoto(false)}
                  />
                </View>
              </View>
              {photo && (
                <>
                  <Text style={s.meta}>
                    Analyze photo sends this image to our recognition service,
                    powered by OpenAI. You can also enter the dish yourself
                    below.
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
              <Text style={[s.sectionTitle, s.flex]}>{cuisine} collection</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Scan food"
                onPress={() => openScan()}
                style={s.iconButton}
              >
                <Icon name="scan-outline" />
              </Pressable>
            </View>
            <ScrollView
              contentContainerStyle={[
                s.detailContent,
                { paddingBottom: insets.bottom + 24 },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {cuisine && (
                <>
                  <CatalogPhoto
                    source={catalogPhoto(cuisineCovers[cuisine])}
                    style={s.banner}
                    label={
                      cuisineCovers[cuisine]
                        ? `${cuisine}: ${cuisineCovers[cuisine].name}`
                        : "Other cuisines"
                    }
                  />
                  <PhotoCredit dish={cuisineCovers[cuisine]} />
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
                dishes to explore
              </Text>
              <View style={s.search}>
                <Icon name="search-outline" size={19} />
                <TextInput
                  accessibilityLabel="Search dishes"
                  placeholder="Find a dish…"
                  placeholderTextColor={colors.muted}
                  value={query}
                  onChangeText={setQuery}
                  style={s.input}
                />
              </View>
              <View style={s.row}>
                {(["all", "collected"] as const).map((item) => (
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
                      {item === "all" ? "All dishes" : "Collected"}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {rows.map((dish, index) => (
                <View key={dish.id} style={s.dishGroup}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${dish.name}, ${dish.entry ? "collected, view discovery" : "not collected, add food"}`}
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
                        #{String(index + 1).padStart(3, "0")} ·{" "}
                        {dish.entry ? "COLLECTED" : "UNDISCOVERED"}
                      </Text>
                      <Text style={s.cardTitle}>{dish.name}</Text>
                      <Text style={s.meta}>{dish.note}</Text>
                    </View>
                    <Icon
                      name={dish.entry ? "checkmark-circle" : "add-outline"}
                      size={20}
                    />
                  </Pressable>
                  {!dish.entry?.photo && (
                    <PhotoCredit dish={dish.catalogDish} />
                  )}
                </View>
              ))}
              {rows.length === 0 && (
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
              )}
              <Button
                title="Add a discovery"
                icon="add-outline"
                onPress={() => openScan()}
              />
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
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
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#364C8499",
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
