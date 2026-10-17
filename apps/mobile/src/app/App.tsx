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
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { migrateWebBookmarks } from "../lib/migrateWebBookmarks";
import { places as bundledPlaces } from "../features/restaurants/data/places";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { FoodCameraScreen } from "../features/food-dex/screens/FoodCameraScreen";
import MapView, { type MapCamera } from "../components/maps";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  categories,
  cuisines,
  foodSpecialties,
  restaurantTypes,
  mapCenter,
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
import { FoodRecommender } from "../features/restaurants/components/FoodRecommender";
import { RestaurantPhotoCredit } from "../features/restaurants/components/RestaurantPhotoCredit";
import { RestaurantPhoto } from "../features/restaurants/components/RestaurantPhoto";
import { CommunityScreen } from "../features/community/screens/CommunityScreens";
import {
  FoodDexScreen,
  type FoodCapture,
} from "../features/food-dex/screens/FoodDexScreen";
import { BackendProvider, useBackend } from "../lib/BackendProvider";
import { useGuestDocument } from "../hooks/useGuestDocument";
import { parseProfile } from "../features/profile/models/profile";

type IconName = React.ComponentProps<typeof Ionicons>["name"];
type FilterDimension =
  "rating" | "restaurantType" | "foodType" | "rarity" | "price" | "cuisine";
const specialtyMatchers: Record<(typeof foodSpecialties)[number], RegExp> = {
  Sushi: /sushi|sashimi/i,
  Healthy: /healthy|health food|vegan|vegetarian|organic|salad|smoothie/i,
  "Bubble Tea": /bubble tea|boba|milk tea/i,
  Wings: /wings?|wing/i,
  Sandwiches: /sandwich|sub shop|deli/i,
  Soup: /soup|pho|ramen/i,
  Poke: /poke|poké/i,
  Burgers: /burger|hamburger/i,
  BBQ: /\bbbq\b|barbecue|smokehouse/i,
  Salads: /salad/i,
};
function matchesTypeFilter(place: Place, value: string) {
  const matcher = (specialtyMatchers as Record<string, RegExp>)[value];
  return matcher
    ? matcher.test(`${place.name} ${place.cuisine ?? ""} ${place.note}`)
    : (place.type ?? place.category) === value;
}
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

function FoodMap({ migrationError = "" }: { migrationError?: string }) {
  const { places, error: backendError } = useBackend();
  const cuisineCategories = [
    "All",
    ...Array.from(
      new Set(
        places
          .map((place) => place.cuisine)
          .filter((cuisine): cuisine is string => Boolean(cuisine)),
      ),
    ).sort(),
  ];
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const camera = useRef<MapCamera>(null);
  const filterButtonRefs = useRef<Record<string, View | null>>({});
  const [category, setCategory] = useState<Category>("All");
  const [openFilter, setOpenFilter] = useState<FilterDimension | null>(null);
  const [filterAnchor, setFilterAnchor] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const [restaurantTypeFilter, setRestaurantTypeFilter] = useState<
    string | null
  >(null);
  const [foodTypeFilter, setFoodTypeFilter] = useState<string | null>(null);
  const [cuisineFilter, setCuisineFilter] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Place | null>(null);
  const { collection, dispatch, storageError } = useRestaurantCollection();
  const saved = collection.saved;
  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [places, collection.ratings],
  );
  const [tab, setTab] = useState<
    | "explore"
    | "saved"
    | "restaurants"
    | "profile"
    | "favorites"
    | "dex"
    | "camera"
  >("explore");
  const cameraReturnTab = useRef<Exclude<typeof tab, "camera">>("explore");
  const {
    value: profile,
    update: setProfile,
    error: profileError,
  } = useGuestDocument<Profile>(
    "profile",
    () => ({
      name: "Food explorer",
      neighborhood: "Toronto",
      diet: "No preference",
    }),
    parseProfile,
  );
  const [recommenderVisible, setRecommenderVisible] = useState(false);
  const [foodCapture, setFoodCapture] = useState<FoodCapture | null>(null);
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
        (!ratingFilter ||
          (collection.ratings[place.id] ?? 0) >= ratingFilter) &&
        (!restaurantTypeFilter ||
          (place.type ?? place.category) === restaurantTypeFilter) &&
        (!foodTypeFilter || matchesTypeFilter(place, foodTypeFilter)) &&
        (!cuisineFilter || place.cuisine === cuisineFilter) &&
        (!savedIds || savedIds.has(place.id)) &&
        `${place.name} ${place.category} ${place.cuisine ?? ""} ${place.neighborhood} ${place.address}`
          .toLowerCase()
          .includes(normalizedQuery),
    );
  }, [
    category,
    deferredQuery,
    savedFilter,
    collection.ratings,
    ratingFilter,
    restaurantTypeFilter,
    foodTypeFilter,
    cuisineFilter,
  ]);
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
  function openFoodCamera() {
    Keyboard.dismiss();
    if (tab !== "camera") cameraReturnTab.current = tab;
    setTab("camera");
    setFoodCapture(null);
    setSelected(null);
    setListVisible(false);
  }
  function resetMap() {
    setSelected(null);
    camera.current?.setCamera({
      centerCoordinate: mapCenter,
      zoomLevel: 10.5,
      animationDuration: 0,
    });
  }
  function selectedFilterLabel(dimension: FilterDimension) {
    if (dimension === "rating") {
      return ratingFilter ? `${ratingFilter}+ stars` : null;
    }
    if (dimension === "restaurantType") return restaurantTypeFilter;
    if (dimension === "foodType") return foodTypeFilter;
    if (dimension === "cuisine") return cuisineFilter;
    return null;
  }
  function closeFilterDropdown() {
    setOpenFilter(null);
    setFilterAnchor(null);
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
      <StatusBar style={tab === "camera" ? "light" : "dark"} />
      {tab === "camera" ? (
        <FoodCameraScreen
          onClose={() => setTab(cameraReturnTab.current)}
          onCapture={(capture) => {
            setFoodCapture(capture);
            setTab("dex");
          }}
        />
      ) : tab === "dex" ? (
        <FoodDexScreen
          key={foodCapture?.id ?? "dex"}
          capture={foodCapture}
          onOpenCamera={openFoodCamera}
        />
      ) : tab === "favorites" ? (
        <CommunityScreen
          collection={collection}
          dispatch={dispatch}
          storageError={migrationError || storageError || backendError}
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
          storageError={migrationError || profileError}
          topInset={insets.top}
          bottomInset={insets.bottom}
        />
      ) : tab === "restaurants" ? (
        <RestaurantsScreen
          collection={collection}
          dispatch={dispatch}
          storageError={migrationError || storageError || backendError}
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
                the restaurants below.
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
                <Image
                  accessibilityLabel="Cibo"
                  source={require("../../../../assets/cibo.png")}
                  resizeMode="contain"
                  style={styles.wordmark}
                />
                <Text style={styles.eyebrow}>GOOD FOOD. GREAT FINDS.</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open AI food recommender"
                onPress={() => {
                  Keyboard.dismiss();
                  setRecommenderVisible(true);
                }}
                style={({ pressed }) => [
                  styles.brand,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="sparkles-outline" size={23} color={colors.accent} />
              </Pressable>
            </View>
            <View style={styles.search}>
              <Icon name="search-outline" color={colors.muted} />
              <TextInput
                accessibilityLabel="Search restaurants"
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
              {!filtersExpanded ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show search filters"
                  accessibilityState={{ expanded: false }}
                  onPress={() => setFiltersExpanded(true)}
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="options-outline" size={17} />
                  <Text style={styles.chipText}>Filters</Text>
                </Pressable>
              ) : (
                <>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Hide search filters"
                    accessibilityState={{ expanded: true }}
                    onPress={() => {
                      setFiltersExpanded(false);
                      setOpenFilter(null);
                    }}
                    style={({ pressed }) => [
                      styles.chip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Icon name="options-outline" size={17} />
                    <Text style={styles.chipText}>Filters ×</Text>
                  </Pressable>
                  {(
                    [
                      "price",
                      "rating",
                      "cuisine",
                      "restaurantType",
                      "foodType",
                      "rarity",
                    ] as const
                  ).map((dimension) =>
                    (() => {
                      const selectedLabel = selectedFilterLabel(dimension);
                      return (
                        <Pressable
                          key={dimension}
                          ref={(ref) => {
                            filterButtonRefs.current[dimension] = ref;
                          }}
                          accessibilityRole="button"
                          accessibilityLabel={`${dimension} filter${selectedLabel ? `: ${selectedLabel}` : ""}`}
                          accessibilityState={{
                            selected: !!selectedLabel,
                            expanded: openFilter === dimension,
                          }}
                          onPress={() => {
                            if (openFilter === dimension) {
                              closeFilterDropdown();
                              return;
                            }
                            setOpenFilter(dimension);
                            filterButtonRefs.current[
                              dimension
                            ]?.measureInWindow((x, y, _width, height) =>
                              setFilterAnchor({ left: x, top: y + height + 6 }),
                            );
                          }}
                          style={({ pressed }) => [
                            styles.chip,
                            selectedLabel && styles.selectedFilterChip,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Icon
                            name={
                              selectedLabel
                                ? "checkmark"
                                : dimension === "price"
                                  ? "cash-outline"
                                  : dimension === "rating"
                                    ? "star"
                                    : dimension === "cuisine"
                                      ? "restaurant-outline"
                                      : dimension === "restaurantType"
                                        ? "storefront-outline"
                                        : dimension === "foodType"
                                          ? "fast-food-outline"
                                          : "sparkles-outline"
                            }
                            size={17}
                          />
                          <Text style={styles.chipText}>
                            {selectedLabel ??
                              (dimension === "restaurantType"
                                ? "Restaurant Type"
                                : dimension === "foodType"
                                  ? "Food Type"
                                  : `${dimension[0]!.toUpperCase()}${dimension.slice(1)}`)}
                          </Text>
                        </Pressable>
                      );
                    })(),
                  )}
                </>
              )}
            </ScrollView>
            {filtersExpanded && openFilter && filterAnchor && (
              <View
                style={[
                  styles.filterDropdown,
                  {
                    left: Math.max(
                      0,
                      Math.min(
                        filterAnchor.left - 20,
                        windowWidth - 40 - Math.min(240, windowWidth - 32),
                      ),
                    ),
                    top: filterAnchor.top - insets.top - 12,
                    width: Math.min(240, windowWidth - 32),
                    maxHeight: Math.max(
                      140,
                      windowHeight - filterAnchor.top - insets.bottom - 12,
                    ),
                  },
                ]}
              >
                <Text style={styles.filterDropdownTitle}>
                  {openFilter === "restaurantType"
                    ? "Restaurant Type"
                    : openFilter === "foodType"
                      ? "Food Type"
                      : `${openFilter[0]!.toUpperCase()}${openFilter.slice(1)}`}
                </Text>
                <ScrollView
                  style={[
                    styles.filterDropdownList,
                    {
                      maxHeight: Math.max(
                        120,
                        windowHeight - filterAnchor.top - insets.bottom - 76,
                      ),
                      ...(openFilter === "rating" ? { height: 46 } : {}),
                    },
                  ]}
                  nestedScrollEnabled
                >
                  {openFilter === "rating" ? (
                    <View style={styles.ratingFilterRow}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <Pressable
                          key={value}
                          accessibilityRole="button"
                          accessibilityLabel={`Filter ${value} stars and up`}
                          accessibilityState={{
                            selected: ratingFilter === value,
                          }}
                          onPress={() => {
                            setRatingFilter(
                              ratingFilter === value ? null : value,
                            );
                            closeFilterDropdown();
                          }}
                          style={styles.ratingFilterStar}
                        >
                          <Icon
                            name={
                              value <= (ratingFilter ?? 0)
                                ? "star"
                                : "star-outline"
                            }
                            color={colors.accent}
                            size={24}
                          />
                        </Pressable>
                      ))}
                    </View>
                  ) : openFilter === "restaurantType" ? (
                    ["Any restaurant type", ...restaurantTypes].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => {
                          setRestaurantTypeFilter(
                            value === "Any restaurant type" ? null : value,
                          );
                          setCategory("All");
                          closeFilterDropdown();
                        }}
                        style={styles.filterDropdownOption}
                      >
                        <Text style={styles.filterDropdownOptionText}>
                          {value}
                        </Text>
                      </Pressable>
                    ))
                  ) : openFilter === "foodType" ? (
                    ["Any food type", ...foodSpecialties].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => {
                          setFoodTypeFilter(
                            value === "Any food type" ? null : value,
                          );
                          closeFilterDropdown();
                        }}
                        style={styles.filterDropdownOption}
                      >
                        <Text style={styles.filterDropdownOptionText}>
                          {value}
                        </Text>
                      </Pressable>
                    ))
                  ) : openFilter === "cuisine" ? (
                    [
                      "Any cuisine",
                      ...cuisines.filter((value) => value !== "Bakery"),
                    ].map((value) => (
                      <Pressable
                        key={value}
                        onPress={() => {
                          setCuisineFilter(
                            value === "Any cuisine" ? null : value,
                          );
                          closeFilterDropdown();
                        }}
                        style={styles.filterDropdownOption}
                      >
                        <Text style={styles.filterDropdownOptionText}>
                          {value}
                        </Text>
                      </Pressable>
                    ))
                  ) : openFilter === "price" ? (
                    <View style={styles.priceFilterOptions}>
                      <Text style={styles.filterDropdownOptionText}>
                        $ · $$ · $$$ · $$$$
                      </Text>
                      <Text style={styles.small}>
                        Price data isn’t available for these listings yet.
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.small}>
                      Rarity data isn’t available for these listings yet.
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}
          </View>

          <View
            pointerEvents="box-none"
            style={[styles.bottom, { bottom: insets.bottom + 90 }]}
          >
            <View style={styles.mapActions}>
              {token && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Show all Toronto restaurants"
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
                    eager
                    showAll
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
                    <RestaurantPhotoCredit place={active} />
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
                  {recommendationLabel(recommendations.get(active.id))} · Sample
                  community reviews
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
                {active.sourceUrl && (
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel={`View listing source for ${active.name}`}
                    onPress={() => {
                      setLinkError(false);
                      void Linking.openURL(active.sourceUrl!).catch(() =>
                        setLinkError(true),
                      );
                    }}
                    style={({ pressed }) => [
                      { minHeight: 44, justifyContent: "center" },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.small}>View listing source ↗</Text>
                  </Pressable>
                )}
                {linkError && (
                  <Text accessibilityRole="alert" style={styles.small}>
                    Couldn’t open this link. Please try again.
                  </Text>
                )}
              </View>
            ) : tab === "saved" ? (
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
                    color={colors.white}
                    size={24}
                  />
                </View>
                <View style={styles.flex}>
                  <Text style={styles.browseTitle}>
                    {visible.length
                      ? `${visible.length} spots to come back to`
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
            ) : null}
          </View>
        </>
      )}
      {tab !== "camera" && (
        <View
          style={[
            styles.nav,
            { position: "absolute", bottom: insets.bottom + 12 },
          ]}
        >
          {(
            [
              ["explore", "restaurants", "dex"],
              "camera",
              ["favorites", "saved", "profile"],
            ] as const
          ).map((group, index) =>
            group === "camera" ? (
              <View key="camera" style={styles.cameraSlot}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Take a food photo"
                  accessibilityHint="Opens the camera to photograph food for your Food Dex"
                  onPress={openFoodCamera}
                  style={({ pressed }) => [
                    styles.cameraButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="camera" size={28} color={colors.white} />
                </Pressable>
              </View>
            ) : (
              <View key={index} style={styles.navGroup}>
                {group.map((item) => (
                  <Pressable
                    key={item}
                    accessibilityRole="tab"
                    accessibilityLabel={
                      item === "explore"
                        ? "Explore"
                        : item === "dex"
                          ? "Food Dex"
                          : item === "restaurants"
                            ? "Restaurants"
                            : item === "saved"
                              ? `Saved${saved.length ? ` · ${saved.length}` : ""}`
                              : item === "favorites"
                                ? "Favorites"
                                : "Profile"
                    }
                    accessibilityState={{ selected: tab === item }}
                    onPress={() => {
                      setTab(item);
                      setFoodCapture(null);
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
                  </Pressable>
                ))}
              </View>
            ),
          )}
        </View>
      )}

      {recommenderVisible && (
        <FoodRecommender
          visible={recommenderVisible}
          diet={profile.diet}
          onClose={() => setRecommenderVisible(false)}
          onSelect={(place) => {
            setRecommenderVisible(false);
            setTab("explore");
            setCategory("All");
            setQuery("");
            choose(place);
          }}
        />
      )}
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
                  {visible.length} restaurants ·{" "}
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
                      showAll
                      place={item}
                      recommendation={recommendations.get(item.id)}
                      style={styles.listImage}
                    />
                    <View style={styles.flex}>
                      <Text style={styles.browseTitle}>{item.name}</Text>
                      <RestaurantPhotoCredit place={item} />
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
  const [ready, setReady] = useState(Platform.OS !== "web");
  const [migrationError, setMigrationError] = useState("");
  useEffect(() => {
    if (Platform.OS !== "web") return;
    let cancelled = false;
    void migrateWebBookmarks(
      AsyncStorage,
      bundledPlaces.map((place) => place.id),
    )
      .catch(() => {
        if (!cancelled)
          setMigrationError(
            "Previous browser bookmarks couldn’t be imported. Reload to retry; the original bookmarks are still stored.",
          );
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (!ready)
    return (
      <View
        style={[
          styles.screen,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <ActivityIndicator
          color={colors.accent}
          accessibilityLabel="Loading your saved places"
        />
      </View>
    );
  return (
    <SafeAreaProvider>
      <BackendProvider>
        <FoodMap migrationError={migrationError} />
      </BackendProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.blue },
  flex: { flex: 1 },
  pressed: { opacity: 0.65 },
  top: {
    position: "absolute",
    left: 20,
    right: 20,
    gap: 14,
    zIndex: 30,
    elevation: 30,
  },
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
    width: 132,
    height: 62,
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
    boxShadow: "0 3px 18px #3D568F10",
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
  filterDropdown: {
    position: "absolute",
    alignSelf: "flex-start",
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 4px 14px #00000030",
    zIndex: 40,
    elevation: 40,
  },
  filterDropdownTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
    marginBottom: 2,
  },
  filterDropdownList: { flexGrow: 0 },
  priceFilterOptions: { gap: 2, paddingVertical: 4 },
  filterDropdownOption: {
    minHeight: 38,
    justifyContent: "center",
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  filterDropdownOptionText: {
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 7,
  },
  ratingFilterRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingFilterStar: {
    minWidth: 40,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
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
  selectedFilterChip: {
    backgroundColor: colors.tint,
    borderColor: colors.accent,
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
    boxShadow: "0 3px 8px #3D568F33",
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
    justifyContent: "flex-end",
    alignItems: "center",
  },
  areaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
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
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 4px 24px #3D568F12",
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
    alignItems: "center",
  },
  cameraSlot: {
    width: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  cameraButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -16,
    backgroundColor: colors.accent,
    borderWidth: 4,
    borderColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px #364C8433",
  },
  navGroup: {
    flex: 1,
    flexDirection: "row",
    padding: 4,
    borderRadius: 32,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    boxShadow: "0 4px 20px #3D568F12",
  },
  navItem: {
    backgroundColor: colors.paper,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 3,
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    borderRadius: 28,
    minHeight: 48,
  },
  navActive: { backgroundColor: colors.tint },
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
