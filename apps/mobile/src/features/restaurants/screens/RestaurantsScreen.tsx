import { useMenuSound } from "../../../hooks/useMenuSound";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { CiboLogo } from "../../../components/CiboLogo";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import {
  useMemo,
  useRef,
  useState,
  useEffect,
  type Dispatch,
  type ReactNode,
  type ComponentProps,
} from "react";
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  matchesDietaryPreference,
  type Category,
  type Place,
} from "../data/places";
import {
  buildRecommendations,
  recommendationBadge,
} from "../models/recommendations";
import { RestaurantPhoto } from "../components/RestaurantPhoto";
import {
  browseRestaurants,
  type RestaurantSort,
} from "../models/restaurantBrowse";
import { colors, discoveryColors } from "../../../theme/index";
import type {
  CollectionAction,
  RestaurantCollection,
} from "../models/restaurantCollection";
import type { DietaryPreference } from "../../profile/models/profile";

import { useBackend } from "../../../lib/BackendProvider";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";

type Props = {
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onClearBrowseFilters?: () => void;
  filteredPlaces?: Place[];
  browseFilters?: ReactNode;
  collection: RestaurantCollection;
  dispatch: Dispatch<CollectionAction>;
  storageError: string;
  onShowMap: (place: Place) => void;
  onOpenMap?: () => void;
  onOpenSaved?: () => void;
  onOpenDex?: () => void;
  onOpenCommunity?: () => void;
  mode?: "discover" | "journal";
  diet: DietaryPreference;
};

const webGlassBlur = (
  Platform.OS === "web"
    ? {
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }
    : {}
) as ViewStyle;
const PAGE_SIZE = 12;

function Icon({
  name,
  color = colors.ink,
  size = 20,
}: {
  name: ComponentProps<typeof Ionicons>["name"];
  color?: string;
  size?: number;
}) {
  return <Ionicons name={name} color={color} size={size} accessible={false} />;
}

export function RestaurantsScreen({
  collection,
  dispatch,
  storageError,
  onShowMap,
  onOpenMap,
  searchQuery,
  onSearchQueryChange,
  onClearBrowseFilters,
  filteredPlaces,
  browseFilters,
  onOpenDex,
  onOpenCommunity,
  mode = "discover",
  diet,
}: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const { places: allPlaces } = useBackend();
  const places = filteredPlaces ?? allPlaces;
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Place>>(null);
  const [collectionTab, setCollectionTab] = useState("saved");
  const [localQuery, setLocalQuery] = useState("");
  const query = searchQuery ?? localQuery;
  const setQuery = onSearchQueryChange ?? setLocalQuery;
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState<Category>("All");
  const [cuisine, setCuisine] = useState("All");
  const [sort, setSort] = useState<RestaurantSort>("discovery");
  const [hiddenGemsOnly, setHiddenGemsOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [listName, setListName] = useState("");
  const [formError, setFormError] = useState("");
  const [managing, setManaging] = useState<Place | null>(null);
  const [actionPlace, setActionPlace] = useState<Place | null>(null);
  const [actionScrimOpacity] = useState(() => new Animated.Value(0));
  const [actionSheetTranslateY] = useState(() => new Animated.Value(windowHeight));
  const [infoVisible, setInfoVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [lastRandomId, setLastRandomId] = useState<string | null>(null);
  useMenuSound(creating);
  useMenuSound(managing !== null);
  useMenuSound(actionPlace !== null);
  useEffect(() => {
    if (actionPlace && reducedMotion === false) {
      actionScrimOpacity.setValue(0);
      actionSheetTranslateY.setValue(windowHeight);
      Animated.parallel([
        Animated.timing(actionScrimOpacity, {
          toValue: 1,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.spring(actionSheetTranslateY, {
          toValue: 0,
          damping: 28,
          stiffness: 260,
          mass: 0.9,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      actionScrimOpacity.setValue(actionPlace ? 1 : 0);
      actionSheetTranslateY.setValue(0);
    }
  }, [actionPlace, actionScrimOpacity, actionSheetTranslateY, reducedMotion, windowHeight]);
  useMenuSound(infoVisible);

  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [places, collection.ratings],
  );
  const visible = useMemo(() => {
    const base = browseRestaurants(
      places,
      { query, category, cuisine, sort },
      recommendations,
    );
    return base.filter((place) => {
      if (mode === "discover" && !matchesDietaryPreference(place, diet))
        return false;
      if (
        hiddenGemsOnly &&
        recommendationBadge(recommendations.get(place.id)) !== "Hidden gem"
      )
        return false;
      if (mode !== "journal") return true;
      if (collectionTab === "saved") return collection.saved.includes(place.id);
      if (collectionTab === "visited")
        return collection.visited.includes(place.id);
      if (collectionTab === "want")
        return (
          collection.saved.includes(place.id) &&
          !collection.visited.includes(place.id)
        );
      return (
        collection.lists
          .find((item) => item.id === collectionTab)
          ?.placeIds.includes(place.id) ?? false
      );
    });
  }, [
    places,
    query,
    category,
    cuisine,
    sort,
    recommendations,
    hiddenGemsOnly,
    mode,
    diet,
    collectionTab,
    collection,
  ]);
  const pageResetKey = JSON.stringify([
    query,
    category,
    cuisine,
    sort,
    hiddenGemsOnly,
    collectionTab,
    mode,
    diet,
  ]);
  const [previousPageResetKey, setPreviousPageResetKey] =
    useState(pageResetKey);
  if (previousPageResetKey !== pageResetKey) {
    setPreviousPageResetKey(pageResetKey);
    setPage(1);
  }
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [query, category, cuisine, sort, hiddenGemsOnly, collectionTab, mode, diet]);
  const pageItems = useMemo(
    () => visible.slice(0, page * PAGE_SIZE),
    [visible, page],
  );

  const hasFilters = Boolean(
    query || category !== "All" || cuisine !== "All" || hiddenGemsOnly ||
      (mode === "discover" &&
        (diet === "Halal" || diet === "Kosher" || diet === "Gluten-free")),
  );

  function resetFilters() {
    onClearBrowseFilters?.();
    setQuery("");
    setCategory("All");
    setCuisine("All");
    setHiddenGemsOnly(false);
    setSort("discovery");
  }

  function createList() {
    const name = listName.trim();
    if (!name) {
      setFormError("Give your list a name.");
      return;
    }
    if (
      collection.lists.some(
        (list) => list.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setFormError("You already have a list with this name.");
      return;
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    dispatch({ type: "create-list", id, name });
    if (managing) {
      dispatch({ type: "membership", listId: id, placeId: managing.id });
      setManaging(null);
    }
    resetFilters();
    if (mode === "journal") setCollectionTab(id);
    setCreating(false);
    setListName("");
    setFormError("");
  }

  function pickRandomSpot() {
    if (!visible.length) return;
    const options =
      visible.length > 1
        ? visible.filter((place) => place.id !== lastRandomId)
        : visible;
    const place = options[Math.floor(Math.random() * options.length)];
    if (place) {
      setLastRandomId(place.id);
      setActionPlace(place);
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={styles.locationRow}>
          <CiboLogo />
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>
              {mode === "journal" ? "YOUR FOOD JOURNAL" : "THE MEALS ALONG THE WAY"}
            </Text>
            <Text accessibilityRole="header" style={styles.location}>
              {mode === "journal" ? "Your food journal" : "Toronto, ON"}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explain restaurant recommendations"
            onPress={() => setInfoVisible(true)}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.pressed,
            ]}
          >
            <Icon name="information-circle-outline" color={colors.muted} />
          </Pressable>
        </View>
        <View style={[styles.search, searchFocused && styles.searchActive]}>
          <Icon name="search-outline" color={colors.muted} />
          <TextInput
            accessibilityLabel="Search restaurants by name, food or neighborhood"
            placeholder="Restaurant, food, neighborhood…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={styles.input}
            returnKeyType="search"
          />
          {query ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear restaurant search"
              onPress={() => setQuery("")}
              style={styles.iconButton}
            >
              <Icon name="close" />
            </Pressable>
          ) : null}
        </View>
        {mode === "journal" ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {[
              { id: "saved", name: "Saved", count: collection.saved.length },
              {
                id: "want",
                name: "Want to try",
                count: collection.saved.filter(
                  (id) => !collection.visited.includes(id),
                ).length,
              },
              {
                id: "visited",
                name: "Visited",
                count: collection.visited.length,
              },
              ...collection.lists.map((item) => ({
                id: item.id,
                name: item.name,
                count: item.placeIds.length,
              })),
            ].map((item) => (
              <Pressable
                key={item.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: collectionTab === item.id }}
                onPress={() => setCollectionTab(item.id)}
                style={({ pressed }) => [
                  styles.chip,
                  collectionTab === item.id && styles.selectedChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.chipText}>
                  {item.name} · {item.count}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setCreating(true)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Icon name="add" size={16} />
              <Text style={styles.chipText}>New list</Text>
            </Pressable>
          </ScrollView>
        ) : (
          browseFilters
        )}

        {storageError ? (
          <Text accessibilityRole="alert" style={styles.notice}>
            {storageError}
          </Text>
        ) : null}
        {mode === "journal" && (
          <View style={styles.optionRow}>
            {onOpenDex && (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenDex}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="book-outline" size={16} />
                <Text style={styles.chipText}>Food Dex & atlas</Text>
              </Pressable>
            )}
            {onOpenCommunity && (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenCommunity}
                style={({ pressed }) => [
                  styles.chip,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="people-outline" size={16} />
                <Text style={styles.chipText}>Friends & favorites</Text>
              </Pressable>
            )}
          </View>
        )}
        {(hasFilters || sort !== "discovery") && (
          <View style={styles.sectionRow}>
            <Text style={[styles.small, styles.flex]}>
              {[
                cuisine !== "All" ? cuisine : "",
                category !== "All" ? category : "",
                hiddenGemsOnly ? "Hidden gems" : "",
                sort === "name" ? "A–Z" : "",
              ]
                .filter(Boolean)
                .join(" · ") || "Search results"}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={resetFilters}
              style={styles.iconButton}
            >
              <Text style={styles.chipText}>Reset</Text>
            </Pressable>
          </View>
        )}
      </View>

      <FlatList
        ref={list}
        data={pageItems}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={5}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 112 },
        ]}
        ListHeaderComponent={
          <View style={styles.resultsRow}>
            <Text accessibilityRole="header" style={styles.resultsTitle}>
              {visible.length} {visible.length === 1 ? "spot" : "spots"}
              {mode === "discover" ? " to explore" : " in your journal"}
            </Text>
            {mode === "discover" && onOpenMap && (
              <Pressable
                accessibilityRole="button"
                onPress={onOpenMap}
                style={({ pressed }) => [
                  styles.mapButton,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="map-outline" size={16} />
                <Text style={styles.chipText}>Map</Text>
              </Pressable>
            )}
            {mode === "discover" && visible.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Pick a random restaurant from these results"
                onPress={pickRandomSpot}
                style={({ pressed }) => [
                  styles.randomButton,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="dice-outline" size={16} color={colors.accent} />
                <Text style={styles.chipText}>Pick a spot</Text>
              </Pressable>
            )}
          </View>
        }
        ListFooterComponent={
          pageItems.length < visible.length ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Show more restaurants, ${visible.length - pageItems.length} remaining`}
              onPress={() => setPage((current) => current + 1)}
              style={({ pressed }) => [
                styles.loadMore,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.chipText}>
                Show more spots ({visible.length - pageItems.length} left)
              </Text>
              <Icon name="chevron-down" size={16} color={colors.accent} />
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon
              name={hasFilters ? "search-outline" : "restaurant-outline"}
              size={26}
              color={colors.accent}
            />
            <Text style={styles.sectionTitle}>
              {hasFilters
                ? "No matches this time"
                : mode === "journal"
                  ? "Your next find belongs here"
                  : "Good food, close by"}
            </Text>
            <Text style={styles.emptyCopy}>
              {hasFilters
                ? mode === "discover" &&
                  (diet === "Halal" || diet === "Kosher" || diet === "Gluten-free")
                  ? `No restaurants with confirmed ${diet} information match. Try another filter or change your dietary preference in Settings.`
                  : "Try another food or neighborhood, or clear your filters."
                : mode === "journal"
                  ? "Bookmark a restaurant in Discover, or add a visited spot to this collection."
                  : "Discover a spot and save it for later."}
            </Text>
            {hasFilters ? (
              <Pressable
                accessibilityRole="button"
                onPress={resetFilters}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.primaryText}>Clear filters</Text>
              </Pressable>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const rec = recommendations.get(item.id);
          return (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View details for ${item.name}`}
                onPress={() => setActionPlace(item)}
                style={({ pressed }) => [
                  styles.cardMain,
                  pressed && styles.pressed,
                ]}
              >
                <RestaurantPhoto
                  showAll
                  place={item}
                  recommendation={rec}
                  style={styles.photo}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.eyebrow} numberOfLines={1}>
                    {item.category}
                    {item.cuisine ? ` · ${item.cuisine}` : ""}
                  </Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.small} numberOfLines={1}>
                    {item.neighborhood}
                  </Text>
                  <View style={styles.ratingRow}>
                    <Icon name="star" size={13} color={discoveryColors.gold} />
                    <Text style={styles.ratingText}>
                      {rec?.averageRating
                        ? rec.averageRating.toFixed(1)
                        : (item.rating?.toFixed(1) ?? "New")}
                    </Text>
                  </View>
                  <Text style={styles.badge}>
                    {rec?.averageRating
                      ? recommendationBadge(rec)
                      : item.rating != null
                        ? "Sample rating"
                        : recommendationBadge(rec)}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        }}
      />

      <Modal
        visible={infoVisible}
        transparent
        animationType={reducedMotion === false ? "fade" : "none"}
        onRequestClose={() => setInfoVisible(false)}
      >
        <View style={styles.modal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close recommendation info"
            style={styles.scrim}
            onPress={() => setInfoVisible(false)}
          />
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <SheetDragHandle onDismiss={() => setInfoVisible(false)} />
            <View style={styles.sectionRow}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, styles.flex]}
              >
                How Cibo suggests
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close recommendation info"
                onPress={() => setInfoVisible(false)}
                style={styles.iconButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            <Text style={styles.note}>
              Cibo balances great ratings (60%) with fewer reviews (40%), so you
              can find hidden gems instead of only the most popular spots. Rate
              a place to personalize your results.
            </Text>
            <Text style={styles.small}>
              Labels: “Hidden gem,” “Highly rated,” and “Worth exploring.”
            </Text>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!actionPlace}
        transparent
        animationType="none"
        onRequestClose={() => setActionPlace(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modal}
        >
          <Animated.View
            pointerEvents="box-none"
            style={[styles.scrim, { opacity: actionScrimOpacity }]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close actions"
              style={StyleSheet.absoluteFill}
              onPress={() => setActionPlace(null)}
            />
          </Animated.View>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { transform: [{ translateY: actionSheetTranslateY }] },
              { paddingBottom: insets.bottom + 24, maxHeight: "80%" },
            ]}
          >
            <SheetDragHandle onDismiss={() => setActionPlace(null)} />
            <View style={styles.sectionRow}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, styles.flex]}
              >
                {actionPlace?.name}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close actions"
                onPress={() => setActionPlace(null)}
                style={styles.iconButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {actionPlace ? (
              <ScrollView contentContainerStyle={styles.filterContent}>
                <RestaurantPhoto
                  showAll
                  place={actionPlace}
                  recommendation={recommendations.get(actionPlace.id)}
                  style={styles.detailPhoto}
                />
                <Text style={styles.small}>
                  {actionPlace.cuisine || actionPlace.category} ·{" "}
                  {actionPlace.neighborhood}
                </Text>
                <Text style={styles.note}>{actionPlace.note}</Text>
                <Text style={styles.small}>{actionPlace.address}</Text>
                {actionPlace.rating != null && (
                  <View style={styles.detailRating}>
                    <Icon name="star" size={16} color={colors.gold} />
                    <Text style={styles.ratingText}>
                      {actionPlace.rating.toFixed(1)} / 5
                    </Text>
                    <Text style={styles.small}>Sample directory rating</Text>
                  </View>
                )}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setActionPlace(null);
                    onShowMap(actionPlace);
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryText}>View on map</Text>
                </Pressable>
                <Text style={styles.fieldLabel}>Your rating</Text>
                <View style={styles.optionRow}>
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <Pressable
                      key={rating}
                      accessibilityRole="button"
                      accessibilityLabel={`Rate ${actionPlace.name} ${rating} stars`}
                      accessibilityHint="Tap your selected rating to clear it"
                      accessibilityState={{
                        selected: collection.ratings[actionPlace.id] === rating,
                      }}
                      onPress={() =>
                        dispatch({
                          type: "rate",
                          placeId: actionPlace.id,
                          rating:
                            collection.ratings[actionPlace.id] === rating
                              ? 0
                              : rating,
                        })
                      }
                      style={({ pressed }) => [
                        styles.iconButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Icon
                        name={
                          rating <= (collection.ratings[actionPlace.id] ?? 0)
                            ? "star"
                            : "star-outline"
                        }
                        color={colors.accent}
                      />
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: collection.visited.includes(actionPlace.id),
                  }}
                  onPress={() => {
                    dispatch({ type: "visit", placeId: actionPlace.id });
                  }}
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={
                      collection.visited.includes(actionPlace.id)
                        ? "checkmark-circle"
                        : "checkmark-circle-outline"
                    }
                    color={colors.accent}
                  />
                  <Text style={styles.actionTextLarge}>
                    {collection.visited.includes(actionPlace.id)
                      ? "Visited"
                      : "Been here?"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setManaging(actionPlace);
                    setActionPlace(null);
                  }}
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="albums-outline" color={colors.accent} />
                  <Text style={styles.actionTextLarge}>Add to collection</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{
                    selected: collection.saved.includes(actionPlace.id),
                  }}
                  onPress={() =>
                    dispatch({ type: "save", placeId: actionPlace.id })
                  }
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={
                      collection.saved.includes(actionPlace.id)
                        ? "bookmark"
                        : "bookmark-outline"
                    }
                  />
                  <Text style={styles.actionTextLarge}>
                    {collection.saved.includes(actionPlace.id)
                      ? "Remove bookmark"
                      : "Save restaurant"}
                  </Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={creating || !!managing}
        transparent
        animationType={reducedMotion === false ? "slide" : "none"}
        onRequestClose={() => {
          setCreating(false);
          setManaging(null);
        }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modal}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close list editor"
            style={styles.scrim}
            onPress={() => {
              setCreating(false);
              setManaging(null);
            }}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + 24, maxHeight: "80%" },
            ]}
          >
            <SheetDragHandle
              onDismiss={() => {
                setCreating(false);
                setManaging(null);
              }}
            />
            <View style={styles.sectionRow}>
              <Text
                accessibilityRole="header"
                style={[styles.sectionTitle, styles.flex]}
              >
                {creating
                  ? "Make room for a craving"
                  : `Lists for ${managing?.name}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close list editor"
                onPress={() => {
                  setCreating(false);
                  setManaging(null);
                }}
                style={styles.iconButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>
            {creating ? (
              <>
                <Text style={styles.small}>
                  Weekend brunch, date night, or just because.
                </Text>
                <Text style={styles.fieldLabel}>List name</Text>
                <TextInput
                  autoFocus
                  accessibilityLabel="List name"
                  placeholder="e.g. Weekend favorites"
                  placeholderTextColor={colors.muted}
                  value={listName}
                  onChangeText={(value) => {
                    setListName(value);
                    setFormError("");
                  }}
                  maxLength={40}
                  onSubmitEditing={createList}
                  returnKeyType="done"
                  style={styles.nameInput}
                />
                {formError ? (
                  <Text accessibilityRole="alert" style={styles.notice}>
                    {formError}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={createList}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryText}>Create list</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.small}>
                  Adding a spot to a list also saves it to your journal.
                </Text>
                <ScrollView
                  contentContainerStyle={styles.memberships}
                  keyboardShouldPersistTaps="handled"
                >
                  {collection.lists.map((list) => {
                    const checked =
                      !!managing && list.placeIds.includes(managing.id);
                    return (
                      <Pressable
                        key={list.id}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        onPress={() =>
                          managing &&
                          dispatch({
                            type: "membership",
                            listId: list.id,
                            placeId: managing.id,
                          })
                        }
                        style={({ pressed }) => [
                          styles.membership,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Icon name="list-outline" color={colors.accent} />
                        <Text style={[styles.name, styles.flex]}>
                          {list.name}
                        </Text>
                        <Icon
                          name={checked ? "checkbox" : "square-outline"}
                          color={colors.accent}
                        />
                      </Pressable>
                    );
                  })}
                  {!collection.lists.length && (
                    <Text style={styles.note}>
                      Create your first list to group your favorite finds.
                    </Text>
                  )}
                </ScrollView>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setCreating(true);
                    setFormError("");
                  }}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryText}>Create a new list</Text>
                </Pressable>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 16,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  flex: { flex: 1 },
  header: {
    gap: 10,
    paddingBottom: 4,
    paddingHorizontal: 16,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  location: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    color: colors.muted,
  },
  search: {
    ...webGlassBlur,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 16,
    backgroundColor: "rgba(255,253,245,0.50)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.70)",
    boxShadow: "0 8px 24px #3D568F18",
  },
  searchActive: {
    borderColor: colors.accent,
    boxShadow: "0 10px 28px #3D568F30",
    backgroundColor: "rgba(255,253,245,0.72)",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 15,
    minHeight: 52,
  },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chips: { flexDirection: "row", gap: 8 },
  chip: {
    ...webGlassBlur,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "rgba(255,253,245,0.48)",
  },
  selectedChip: {
    backgroundColor: "rgba(234,243,178,0.64)",
    borderColor: "rgba(61,86,143,0.38)",
  },
  chipText: { fontSize: 12, fontWeight: "600", color: colors.ink },
  notice: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    backgroundColor: colors.tint,
    borderRadius: 12,
    padding: 12,
  },
  card: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 8,
    minHeight: 124,
  },
  cardMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 104,
  },
  photo: {
    width: 104,
    height: 104,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  cardBody: { flex: 1, minWidth: 0, gap: 4 },
  name: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  ratingText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
  },
  detailRating: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.accent,
    backgroundColor: colors.tint,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  bookmarkButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.paper,
  },
  bookmarkSaved: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  note: { fontSize: 12, lineHeight: 18, color: colors.muted },
  empty: { alignItems: "center", paddingVertical: 28, gap: 16 },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 300,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.ink,
    flexShrink: 1,
  },
  primaryButton: {
    minHeight: 50,
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: 16,
    marginTop: 8,
  },
  primaryText: { color: colors.white, fontSize: 14, fontWeight: "600" },
  pressed: { opacity: 0.65 },
  modal: { flex: 1, justifyContent: "flex-end" },
  scrim: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 12,
  },
  nameInput: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    color: colors.ink,
    backgroundColor: colors.white,
    fontSize: 16,
  },
  memberships: { paddingVertical: 8 },
  membership: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  filterScroll: { flexGrow: 0 },
  filterContent: { gap: 12, paddingBottom: 8 },
  detailPhoto: { width: "100%", height: 160, borderRadius: 16 },
  filterDot: {
    position: "absolute",
    right: 7,
    top: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    gap: 8,
  },
  resultsTitle: { fontSize: 13, fontWeight: "600", color: colors.ink, flex: 1 },
  randomButton: {
    minHeight: 42,
    paddingHorizontal: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mapButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  loadMore: {
    minHeight: 48,
    marginVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  optionChip: {
    ...webGlassBlur,
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(255,253,245,0.44)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  actionTextLarge: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.ink,
  },
});
