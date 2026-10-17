import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import MapView, { type MapCamera } from "../components/maps";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  categories,
  mapCenter,
  places,
  type Category,
  type Place,
} from "../features/restaurants/data/places";

import {
  ProfileScreen,
  type Profile,
} from "../features/profile/screens/ProfileScreen";

const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
import { colors } from "../theme/index";
import { RestaurantsScreen } from "../features/restaurants/screens/RestaurantsScreen";
import { useRestaurantCollection } from "../features/restaurants/hooks/useRestaurantCollection";
import {
  buildRecommendations,
  recommendationLabel,
} from "../features/restaurants/models/recommendations";
import { RestaurantPhoto } from "../features/restaurants/components/RestaurantPhoto";
import { CommunityScreen } from "../features/community/screens/CommunityScreens";
import { FoodDexScreen } from "../features/food-dex/screens/FoodDexScreen";
import { startSupabaseSessionRefresh } from "../lib/supabase";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
const categoryIcons: Record<Category, IconName> = {
  All: "grid-outline",
  Coffee: "cafe-outline",
  Pizza: "pizza-outline",
  Bakery: "storefront-outline",
  Ramen: "restaurant-outline",
  Restaurant: "restaurant-outline",
};

function Icon({
  name,
  size = 20,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} accessible={false} />;
}

function FoodMap() {
  const insets = useSafeAreaInsets();
  const camera = useRef<MapCamera>(null);
  const [category, setCategory] = useState<Category>("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const { collection, dispatch, storageError } = useRestaurantCollection();
  const saved = collection.saved;
  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [collection.ratings],
  );
  const [tab, setTab] = useState<
    "explore" | "saved" | "restaurants" | "profile" | "favorites" | "dex"
  >("explore");
  const [profile, setProfile] = useState<Profile>({
    name: "Food explorer",
    neighborhood: "Toronto",
    diet: "No preference",
  });
  const [listVisible, setListVisible] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [linkError, setLinkError] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const savedFilter = tab === "explore" ? null : saved;
  const visible = useMemo(() => {
    const normalizedQuery = deferredQuery.toLowerCase().trim();
    const savedIds = savedFilter ? new Set(savedFilter) : null;
    return places.filter(
      (place) =>
        (category === "All" || place.category === category) &&
        (!savedIds || savedIds.has(place.id)) &&
        `${place.name} ${place.category} ${place.cuisine ?? ""} ${place.neighborhood} ${place.address}`
          .toLowerCase()
          .includes(normalizedQuery),
    );
  }, [category, deferredQuery, savedFilter]);
  const rankedVisible = useMemo(
    () =>
      [...visible].sort(
        (a, b) =>
          (recommendations.get(b.id)?.score ?? 0) -
          (recommendations.get(a.id)?.score ?? 0),
      ),
    [visible, recommendations],
  );
  const active =
    selected && visible.some((place) => place.id === selected.id)
      ? selected
      : null;

  const choose = useCallback((place: Place) => {
    Keyboard.dismiss();
    setSelected(place);
    setLinkError(false);
    setListVisible(false);
    camera.current?.setCamera({
      centerCoordinate: place.coordinate,
      zoomLevel: 14.7,
      animationDuration: 0,
    });
  }, []);
  const onMapReady = useCallback(() => {
    setMapReady(true);
    setMapError(false);
  }, []);
  const onMapError = useCallback(() => {
    setMapError(true);
    setMapReady(false);
  }, []);
  function toggleSave(place: Place) {
    dispatch({ type: "save", placeId: place.id });
  }
  function resetMap() {
    setSelected(null);
    camera.current?.setCamera({
      centerCoordinate: mapCenter,
      zoomLevel: 10.5,
      animationDuration: 0,
    });
  }

  const renderPlaceMarker = useCallback(
    (place: Place, selected: boolean) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${recommendations.get(place.id)?.suggested ? "Suggested: " : ""}View ${place.name}, ${place.category}`}
        accessibilityState={{ selected }}
        onPress={() => choose(place)}
        style={({ pressed }) => [styles.markerWrap, pressed && styles.pressed]}
      >
        <View
          style={[
            styles.photoMarker,
            selected && styles.selectedMarker,
            !recommendations.get(place.id)?.suggested && styles.plainMarker,
          ]}
        >
          <RestaurantPhoto
            place={place}
            recommendation={recommendations.get(place.id)}
            style={styles.markerImage}
          />
          {!recommendations.get(place.id)?.suggested && (
            <Icon name={categoryIcons[place.category]} />
          )}
          <View style={styles.markerBadge}>
            <Icon name={categoryIcons[place.category]} size={12} />
          </View>
        </View>
        <Text numberOfLines={1} style={styles.markerLabel}>
          {recommendations.get(place.id)?.suggested ? "Suggested · " : ""}
          {place.name}
        </Text>
      </Pressable>
    ),
    [choose, recommendations],
  );

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      {tab === "dex" ? (
        <FoodDexScreen />
      ) : tab === "favorites" ? (
        <CommunityScreen
          collection={collection}
          dispatch={dispatch}
          storageError={storageError}
          onShowMap={(place) => {
            setTab("explore");
            setCategory("All");
            setQuery("");
            choose(place);
          }}
        />
      ) : tab === "profile" ? (
        <ProfileScreen
          saved={saved}
          profile={profile}
          onSave={setProfile}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      ) : tab === "restaurants" ? (
        <RestaurantsScreen
          collection={collection}
          dispatch={dispatch}
          storageError={storageError}
          onShowMap={(place) => {
            setTab("explore");
            setCategory("All");
            setQuery("");
            choose(place);
          }}
        />
      ) : (
        <>
          {token ? (
            <MapView
              ref={camera}
              token={token}
              center={selected?.coordinate ?? mapCenter}
              zoom={selected ? 14.7 : 10.5}
              topInset={insets.top}
              bottomInset={insets.bottom}
              places={visible}
              selectedId={active?.id}
              onSelect={choose}
              onReady={onMapReady}
              onError={onMapError}
              renderPlaceMarker={renderPlaceMarker}
              recommendations={recommendations}
            />
          ) : (
            <View style={styles.emptyMap}>
              <Icon name="map-outline" size={46} color={colors.accent} />
              <Text style={styles.emptyTitle}>Your next bite starts here</Text>
              <Text style={styles.emptyCopy}>
                Add your Mapbox public token to load the map. You can explore
                the sample places below.
              </Text>
              <Text style={styles.setupCode}>
                EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
              </Text>
            </View>
          )}
          {token && (!mapReady || mapError) && (
            <View pointerEvents="none" style={styles.mapStatus}>
              {mapError ? (
                <>
                  <Icon name="cloud-offline-outline" />
                  <Text style={styles.emptyCopy}>
                    The map couldn’t load. Check your connection and Mapbox
                    token.
                  </Text>
                </>
              ) : (
                <>
                  <ActivityIndicator color={colors.accent} />
                  <Text style={styles.small}>Loading your neighborhood…</Text>
                </>
              )}
            </View>
          )}

          <View
            pointerEvents="box-none"
            style={[styles.top, { top: insets.top + 12 }]}
          >
            <View style={styles.headingRow}>
              <View>
                <Text accessibilityRole="header" style={styles.wordmark}>
                  Cibo
                </Text>
                <Text style={styles.eyebrow}>GOOD FOOD. GREAT FINDS.</Text>
              </View>
              <View style={styles.brand}>
                <Icon name="sparkles-outline" size={23} color={colors.accent} />
              </View>
            </View>
            <View style={styles.search}>
              <Icon name="search-outline" color={colors.muted} />
              <TextInput
                accessibilityLabel="Search sample food places"
                placeholder="Coffee, pizza, a little treat…"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
                style={styles.input}
                returnKeyType="search"
              />
              {query.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search"
                  onPress={() => setQuery("")}
                  style={styles.clear}
                >
                  <Icon name="close" size={18} />
                </Pressable>
              )}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              {categories.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === item }}
                  onPress={() => setCategory(item)}
                  style={({ pressed }) => [
                    styles.chip,
                    category === item && styles.chipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={categoryIcons[item]}
                    size={17}
                    color={category === item ? colors.white : colors.ink}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      category === item && styles.chipTextActive,
                    ]}
                  >
                    {item === "All" ? "Everything" : item}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View
            pointerEvents="box-none"
            style={[styles.bottom, { bottom: insets.bottom + 90 }]}
          >
            <View style={styles.mapActions}>
              <View style={styles.areaPill}>
                <View style={styles.dot} />
                <Text style={styles.small}>Toronto · Sample places</Text>
              </View>
              {token && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show all Toronto sample places"
                  onPress={resetMap}
                  style={({ pressed }) => [
                    styles.roundButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="locate-outline" />
                </Pressable>
              )}
            </View>
            {active ? (
              <View style={styles.placeCard}>
                <View style={styles.cardTop}>
                  <RestaurantPhoto
                    place={active}
                    recommendation={recommendations.get(active.id)}
                    style={styles.cardImage}
                  />
                  <View style={styles.cardInfo}>
                    <Text style={styles.eyebrow}>
                      {active.category.toUpperCase()} · {active.neighborhood}
                    </Text>
                    <Text style={styles.placeName}>{active.name}</Text>
                    <Text style={styles.small}>{active.note}</Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close place details"
                    onPress={() => setSelected(null)}
                    style={styles.closeButton}
                  >
                    <Icon name="close" size={18} />
                  </Pressable>
                </View>
                <Text style={styles.address}>{active.address}</Text>
                <Text style={styles.small}>
                  {recommendationLabel(recommendations.get(active.id))}
                </Text>
                <View style={styles.ratingRow}>
                  <Text style={styles.small}>Your rating</Text>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Pressable
                      key={value}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${active.name} ${value} ${value === 1 ? "star" : "stars"}`}
                      accessibilityHint="Tap the selected rating again to clear it."
                      accessibilityState={{
                        selected: collection.ratings[active.id] === value,
                      }}
                      onPress={() =>
                        dispatch({
                          type: "rate",
                          placeId: active.id,
                          rating:
                            collection.ratings[active.id] === value ? 0 : value,
                        })
                      }
                      style={({ pressed }) => [
                        styles.ratingStar,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name={
                          value <= (collection.ratings[active.id] ?? 0)
                            ? "star"
                            : "star-outline"
                        }
                        color={colors.accent}
                      />
                    </Pressable>
                  ))}
                </View>
                <View style={styles.cardButtons}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setLinkError(false);
                      void Linking.openURL(
                        `https://www.google.com/maps/dir/?api=1&destination=${active.coordinate[1]},${active.coordinate[0]}`,
                      ).catch(() => setLinkError(true));
                    }}
                    style={({ pressed }) => [
                      styles.directions,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon
                      name="navigate-outline"
                      size={17}
                      color={colors.white}
                    />
                    <Text style={styles.directionsText}>Get directions</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      saved.includes(active.id) ? "Unsave place" : "Save place"
                    }
                    accessibilityState={{ selected: saved.includes(active.id) }}
                    onPress={() => toggleSave(active)}
                    style={({ pressed }) => [
                      styles.saveButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon
                      name={
                        saved.includes(active.id)
                          ? "bookmark"
                          : "bookmark-outline"
                      }
                      color={colors.accent}
                    />
                  </Pressable>
                </View>
                {linkError && (
                  <Text accessibilityRole="alert" style={styles.small}>
                    Couldn’t open directions. Please try again.
                  </Text>
                )}
              </View>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={() => setListVisible(true)}
                style={({ pressed }) => [
                  styles.browseCard,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.browseIcon}>
                  <Icon
                    name={
                      tab === "saved"
                        ? "bookmark-outline"
                        : "restaurant-outline"
                    }
                    color={colors.accent}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.browseTitle}>
                    {visible.length
                      ? `${visible.length} spots to ${tab === "saved" ? "come back to" : "fall in love with"}`
                      : "No spots here yet"}
                  </Text>
                  <Text style={styles.small}>
                    {visible.length
                      ? "Suggestions favor high ratings and fewer reviews."
                      : tab === "saved"
                        ? "Save a place from Explore to find it here."
                        : "Try another category or search."}
                  </Text>
                </View>
                <Icon name="chevron-up" size={18} />
              </Pressable>
            )}
          </View>
        </>
      )}
      <View
        style={[
          styles.nav,
          { position: "absolute", bottom: insets.bottom + 12 },
        ]}
      >
        {(
          [
            "explore",
            "restaurants",
            "dex",
            "favorites",
            "saved",
            "profile",
          ] as const
        ).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
            onPress={() => {
              setTab(item);
              setSelected(null);
            }}
            style={({ pressed }) => [
              styles.navItem,
              tab === item && styles.navActive,
              pressed && styles.pressed,
            ]}
          >
            <Icon
              name={
                item === "explore"
                  ? "compass-outline"
                  : item === "dex"
                    ? "book-outline"
                    : item === "restaurants"
                      ? "restaurant-outline"
                      : item === "saved"
                        ? "bookmark-outline"
                        : item === "favorites"
                          ? "heart-outline"
                          : "person-outline"
              }
              color={tab === item ? colors.accent : colors.muted}
            />
            <Text
              style={[styles.navText, tab === item && styles.navTextActive]}
            >
              {item === "explore"
                ? "Explore"
                : item === "dex"
                  ? "Food Dex"
                  : item === "restaurants"
                    ? "Restaurants"
                    : item === "saved"
                      ? `Saved${saved.length ? ` · ${saved.length}` : ""}`
                      : item === "favorites"
                        ? "Favorites"
                        : "Profile"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Modal
        visible={listVisible}
        animationType="none"
        transparent
        onRequestClose={() => setListVisible(false)}
      >
        <View style={styles.modal}>
          <Pressable
            style={styles.scrim}
            accessibilityLabel="Close places list"
            accessibilityRole="button"
            onPress={() => setListVisible(false)}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 16, maxHeight: "75%" },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <View style={styles.flex}>
                <Text style={styles.placeName}>
                  {tab === "saved"
                    ? "Your little black book"
                    : "Good food, close by"}
                </Text>
                <Text style={styles.small}>
                  {visible.length} sample places ·{" "}
                  {tab === "saved" ? "Saved on this device" : "Toronto"}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close places list"
                onPress={() => setListVisible(false)}
                style={styles.roundButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {listVisible && (
              <FlatList
                data={rankedVisible}
                initialNumToRender={8}
                maxToRenderPerBatch={8}
                windowSize={5}
                keyExtractor={(place) => place.id}
                ListEmptyComponent={
                  <Text style={styles.emptyList}>
                    {tab === "saved"
                      ? "Nothing saved yet. Bookmark a spot in Explore."
                      : "No matches. Try a different search or category."}
                  </Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => choose(item)}
                    style={({ pressed }) => [
                      styles.listRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <RestaurantPhoto
                      place={item}
                      recommendation={recommendations.get(item.id)}
                      style={styles.listImage}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.browseTitle}>{item.name}</Text>
                      <Text style={styles.small}>
                        {item.category} · {item.neighborhood}
                      </Text>
                      <Text style={styles.small}>
                        {recommendationLabel(recommendations.get(item.id))}
                      </Text>
                    </View>
                    <Icon name="chevron-forward" size={18} />
                  </Pressable>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function App() {
  useEffect(() => startSupabaseSessionRefresh(), []);

  return (
    <SafeAreaProvider>
      <FoodMap />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blue },
  flex: { flex: 1 },
  pressed: { opacity: 0.65 },
  top: { position: "absolute", left: 20, right: 20, gap: 14 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.muted,
  },
  wordmark: {
    fontFamily: Platform.select({
      ios: "Baskerville",
      android: "serif",
      web: "Georgia, 'Times New Roman', serif",
    }),
    fontSize: 58,
    lineHeight: 68,
    fontStyle: "italic",
    fontWeight: "600",
    letterSpacing: -3,
    color: colors.ink,
  },
  brand: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 52,
    backgroundColor: colors.white,
    borderRadius: 18,
    boxShadow: "0 3px 18px #364C8410",
    gap: 10,
  },
  input: { flex: 1, color: colors.ink, fontSize: 14, paddingVertical: 15 },
  clear: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { gap: 8, paddingBottom: 5 },
  chip: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 15,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  chipTextActive: { color: colors.white },
  ratingRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
  },
  ratingStar: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  plainMarker: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  markerWrap: { alignItems: "center", width: 112, paddingVertical: 5 },
  photoMarker: {
    width: 58,
    height: 62,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.paper,
    boxShadow: "0 3px 8px #364C8433",
  },
  selectedMarker: { borderColor: colors.accent, width: 66, height: 70 },
  markerImage: { width: "100%", height: "100%", borderRadius: 11 },
  markerBadge: {
    position: "absolute",
    bottom: -5,
    right: -7,
    backgroundColor: colors.white,
    padding: 5,
    borderRadius: 12,
  },
  markerLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.ink,
    marginTop: 7,
    backgroundColor: colors.paper,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  bottom: { position: "absolute", left: 16, right: 16, gap: 12 },
  mapActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  areaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.paper,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  roundButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  browseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 18,
    borderRadius: 24,
    backgroundColor: colors.paper,
    boxShadow: "0 4px 24px #364C8412",
  },
  browseIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: colors.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  browseTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
    marginBottom: 4,
  },
  nav: {
    alignSelf: "center",
    width: "96%",
    maxWidth: 520,
    flexDirection: "row",
    padding: 5,
    borderRadius: 32,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 4px 20px #364C8412",
  },
  navItem: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 3,
    flex: 1,
    minWidth: 48,
    flexShrink: 1,
    borderRadius: 28,
    minHeight: 48,
  },
  navActive: { backgroundColor: colors.tint },
  navText: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.muted,
    textAlign: "center",
  },
  navTextActive: { color: colors.accent },
  placeCard: {
    backgroundColor: colors.paper,
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  cardImage: { width: 70, height: 86, borderRadius: 13 },
  cardInfo: { flex: 1, gap: 5 },
  placeName: {
    fontSize: 21,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.5,
  },
  closeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -8,
    marginTop: -8,
  },
  address: { fontSize: 12, color: colors.muted },
  cardButtons: { flexDirection: "row", gap: 10 },
  directions: {
    flex: 1,
    minHeight: 46,
    backgroundColor: colors.accent,
    borderRadius: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  directionsText: { color: colors.white, fontSize: 13, fontWeight: "600" },
  saveButton: {
    minWidth: 48,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyMap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 35,
    paddingBottom: 35,
    gap: 13,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  setupCode: { fontSize: 10, color: colors.accent, fontWeight: "600" },
  mapStatus: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    alignItems: "center",
    gap: 10,
    padding: 18,
    backgroundColor: colors.paper,
    borderRadius: 18,
    maxWidth: "85%",
  },
  modal: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  sheetHandle: {
    width: 34,
    height: 4,
    borderRadius: 3,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  sheetHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  listImage: { width: 64, height: 64, borderRadius: 14 },
  emptyList: {
    color: colors.muted,
    fontSize: 14,
    paddingVertical: 36,
    textAlign: "center",
  },
});
