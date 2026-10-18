import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ComponentProps,
} from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categories, type Category, type Place } from "../data/places";
import {
  buildRecommendations,
  recommendationLabel,
} from "../models/recommendations";
import { RestaurantPhoto } from "../components/RestaurantPhoto";
import {
  browseRestaurants,
  surpriseCuisine,
  type RestaurantSort,
} from "../models/restaurantBrowse";
import { colors } from "../../../theme/index";
import type {
  RestaurantCollection,
} from "../models/restaurantCollection";

import { useBackend } from "../../../lib/BackendProvider";

type Props = {
  collection: RestaurantCollection;
  dispatch: Dispatch<any>;
  storageError: string;
  onShowMap: (place: Place) => void;
};

const webGlassBlur = (
  Platform.OS === "web"
    ? {
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
      }
    : {}
) as ViewStyle;

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
}: Props) {
  const { places } = useBackend();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Place>>(null);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [category, setCategory] = useState<Category>("All");
  const [cuisine, setCuisine] = useState("All");
  const [sort, setSort] = useState<RestaurantSort>("discovery");
  const [gemsOnly, setGemsOnly] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const cuisineOptions = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          places
            .map((place) => place.cuisine)
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort(),
    ],
    [places],
  );
  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [places, collection.ratings],
  );

  const candidates = useMemo(
    () =>
      gemsOnly
        ? places.filter((place) => recommendations.get(place.id)?.suggested)
        : places,
    [places, gemsOnly, recommendations],
  );
  const visible = useMemo(
    () =>
      browseRestaurants(
        candidates,
        { query, category, cuisine, sort },
        recommendations,
      ),
    [candidates, query, category, cuisine, sort, recommendations],
  );

  const hasFilters = Boolean(
    query || category !== "All" || cuisine !== "All" || gemsOnly,
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <FlatList
        ref={list}
        data={visible}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 100 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.locationRow}>
              <View style={styles.locationLeft}>
                <Icon name="location" color={colors.accent} size={16} />
                <Text style={styles.locationText}>Toronto</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How restaurant suggestions work"
                onPress={() => setInfoOpen(true)}
                style={styles.iconButton}
              >
                <Icon name="information-circle-outline" size={20} />
              </Pressable>
            </View>

            <Text accessibilityRole="header" style={styles.title}>
              Discover restaurants
            </Text>

            {storageError ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {storageError}
              </Text>
            ) : null}

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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: !gemsOnly && sort === "discovery" && category === "All" && cuisine === "All" && !query }}
                onPress={() => {
                  setGemsOnly(false);
                  setCategory("All");
                  setCuisine("All");
                  setSort("discovery");
                  setQuery("");
                }}
                style={({ pressed }) => [
                  styles.chip,
                  !gemsOnly && sort === "discovery" && category === "All" && cuisine === "All" && !query && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="sparkles-outline" size={16} />
                <Text style={styles.chipText}>For you</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: gemsOnly }}
                onPress={() => setGemsOnly((value) => !value)}
                style={({ pressed }) => [
                  styles.chip,
                  gemsOnly && styles.chipActive,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="diamond-outline" size={16} />
                <Text style={styles.chipText}>Hidden gems</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Surprise me with another cuisine"
                onPress={() => {
                  setCuisine(surpriseCuisine(cuisineOptions, cuisine));
                  setQuery("");
                  setCategory("All");
                  setGemsOnly(false);
                  list.current?.scrollToOffset({ offset: 0, animated: false });
                }}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Icon name="shuffle-outline" size={16} />
                <Text style={styles.chipText}>Surprise me</Text>
              </Pressable>

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
                  <Text style={styles.chipText}>
                    {item === "All" ? "All food" : item}
                  </Text>
                </Pressable>
              ))}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open sort and filters"
                onPress={() => setFilterSheetOpen(true)}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
              >
                <Icon name="options-outline" size={16} />
                <Text style={styles.chipText}>Filters</Text>
              </Pressable>
            </ScrollView>

            <View style={styles.resultsRow}>
              <Text style={styles.resultsTitle}>
                {gemsOnly ? "Hidden gems nearby" : "Good food, close by"}
              </Text>
              <Text style={styles.resultsCount}>
                {visible.length} {visible.length === 1 ? "spot" : "spots"}
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Icon
              name={hasFilters ? "search-outline" : "restaurant-outline"}
              size={26}
              color={colors.accent}
            />
            <Text style={styles.sectionTitle}>
              {hasFilters ? "No matches this time" : "Your next favorite goes here"}
            </Text>
            <Text style={styles.emptyCopy}>
              {hasFilters
                ? "Try another food, cuisine, or clear your filters."
                : "Discover a spot and bookmark it for later."}
            </Text>
            {hasFilters ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setQuery("");
                  setCategory("All");
                  setCuisine("All");
                  setGemsOnly(false);
                }}
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
          const saved = collection.saved.includes(item.id);
          const rating = recommendations.get(item.id);
          return (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name} on map`}
                onPress={() => onShowMap(item)}
                style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
              >
                <RestaurantPhoto
                  showAll
                  place={item}
                  recommendation={rating}
                  style={styles.photo}
                />
                <View style={styles.cardBody}>
                  <Text style={styles.cardEyebrow}>{item.category}</Text>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardMeta} numberOfLines={1}>
                    {item.neighborhood}
                    {item.cuisine ? ` · ${item.cuisine}` : ""}
                  </Text>
                  <View style={styles.cardRatingRow}>
                    <Icon name="star" size={13} color={colors.gold} />
                    <Text style={styles.cardRating}>
                      {rating?.averageRating
                        ? rating.averageRating.toFixed(1)
                        : "New"}
                    </Text>
                    <Text style={styles.cardBadge}>
                      {recommendationLabel(rating)}
                    </Text>
                  </View>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    saved ? `Remove ${item.name} from saved` : `Save ${item.name}`
                  }
                  accessibilityState={{ selected: saved }}
                  onPress={() => dispatch({ type: "save", placeId: item.id })}
                  style={({ pressed }) => [
                    styles.bookmarkButton,
                    saved && styles.bookmarkSaved,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={saved ? "bookmark" : "bookmark-outline"}
                    size={20}
                    color={saved ? colors.white : colors.accent}
                  />
                </Pressable>
              </Pressable>
            </View>
          );
        }}
      />

      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterSheetOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modal}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close filters"
            style={styles.scrim}
            onPress={() => setFilterSheetOpen(false)}
          />
          <View
            accessibilityViewIsModal
            style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.sheetHeader}>
              <Text accessibilityRole="header" style={styles.sheetTitle}>
                Sort & filter
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close filters"
                onPress={() => setFilterSheetOpen(false)}
                style={styles.iconButton}
              >
                <Icon name="close" />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>Sort</Text>
            <View style={styles.optionRow}>
              {(["discovery", "name"] as const).map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sort === item }}
                  onPress={() => setSort(item)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    sort === item && styles.optionChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      sort === item && styles.optionTextActive,
                    ]}
                  >
                    {item === "name" ? "A–Z" : "Discovery"}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Cuisine</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {cuisineOptions.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: cuisine === item }}
                  onPress={() => setCuisine(item)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    cuisine === item && styles.optionChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      cuisine === item && styles.optionTextActive,
                    ]}
                  >
                    {item === "All" ? "All cuisines" : item}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>Category</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {categories.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === item }}
                  onPress={() => setCategory(item)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    category === item && styles.optionChipActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionText,
                      category === item && styles.optionTextActive,
                    ]}
                  >
                    {item === "All" ? "All food" : item}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuery("");
                setCategory("All");
                setCuisine("All");
                setGemsOnly(false);
                setSort("discovery");
                setFilterSheetOpen(false);
                list.current?.scrollToOffset({ offset: 0, animated: false });
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Reset filters</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={infoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setInfoOpen(false)}
      >
        <Pressable
          style={styles.infoScrim}
          onPress={() => setInfoOpen(false)}
        >
          <View style={styles.infoCard}>
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              How suggestions work
            </Text>
            <Text style={styles.infoText}>
              Cibo blends great ratings (60%) with lesser-known spots (40%).
              Places with high ratings and fewer reviews surface as hidden
              gems, while popular favorites stay highly rated.
            </Text>
            <Text style={styles.infoText}>
              Tap a restaurant to rate it from its map card. Your ratings
              personalize future suggestions.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setInfoOpen(false)}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>Got it</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 16,
    width: "100%",
    alignSelf: "center",
    maxWidth: 520,
  },
  flex: { flex: 1 },
  header: { gap: 12, paddingBottom: 12 },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  locationLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  locationText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.ink,
  },
  notice: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    backgroundColor: colors.tint,
    borderRadius: 12,
    padding: 12,
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
  chips: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  chip: {
    ...webGlassBlur,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.68)",
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    backgroundColor: "rgba(255,253,245,0.48)",
  },
  chipActive: {
    backgroundColor: "rgba(61,86,143,0.76)",
    borderColor: "rgba(255,255,255,0.48)",
  },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  resultsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  resultsCount: { fontSize: 12, color: colors.muted },
  card: {
    borderRadius: 18,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    minHeight: 120,
  },
  photo: {
    width: 104,
    height: 104,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  cardBody: { flex: 1, gap: 3 },
  cardEyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.muted,
    textTransform: "uppercase",
  },
  cardName: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.ink,
  },
  cardMeta: { fontSize: 12, color: colors.muted },
  cardRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  cardRating: { fontSize: 13, fontWeight: "600", color: colors.ink },
  cardBadge: { fontSize: 12, color: colors.accent, marginLeft: 4 },
  bookmarkButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
  empty: { alignItems: "center", paddingVertical: 32, gap: 12 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
  },
  emptyCopy: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 280,
  },
  primaryButton: {
    minHeight: 48,
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderRadius: 14,
    marginTop: 4,
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: 10,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.ink,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.ink,
    marginTop: 8,
  },
  optionRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  optionChip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  optionChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  optionText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  optionTextActive: { color: colors.white },
  infoScrim: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: "center",
    padding: 24,
  },
  infoCard: {
    backgroundColor: colors.paper,
    borderRadius: 20,
    padding: 20,
    gap: 12,
  },
  infoText: { fontSize: 13, lineHeight: 20, color: colors.muted },
});
