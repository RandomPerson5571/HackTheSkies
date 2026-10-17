import { useMemo, useState, type Dispatch, type ComponentProps } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { categories, places, type Category, type Place } from "../data/places";
import {
  buildRecommendations,
  recommendationLabel,
} from "../models/recommendations";
import { RestaurantPhoto } from "../components/RestaurantPhoto";
import { colors } from "../../../theme/index";
import type {
  CollectionAction,
  RestaurantCollection,
} from "../models/restaurantCollection";

type Props = {
  collection: RestaurantCollection;
  dispatch: Dispatch<CollectionAction>;
  storageError: string;
  onShowMap: (place: Place) => void;
};
type Filter = "discover" | "want" | "visited" | `list:${string}`;

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
  const insets = useSafeAreaInsets();
  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [collection.ratings],
  );
  const [filter, setFilter] = useState<Filter>("discover");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category>("All");
  const [creating, setCreating] = useState(false);
  const [listName, setListName] = useState("");
  const [formError, setFormError] = useState("");
  const [managing, setManaging] = useState<Place | null>(null);
  const wantCount = collection.saved.filter(
    (id) => !collection.visited.includes(id),
  ).length;
  const activeList = collection.lists.find(
    (list) => `list:${list.id}` === filter,
  );
  const options: {
    id: Filter;
    label: string;
    count: number;
    icon: ComponentProps<typeof Ionicons>["name"];
  }[] = [
    {
      id: "discover",
      label: "Discover",
      count: places.length,
      icon: "compass-outline",
    },
    {
      id: "want",
      label: "Want to try",
      count: wantCount,
      icon: "bookmark-outline",
    },
    {
      id: "visited",
      label: "Visited",
      count: collection.visited.length,
      icon: "checkmark-circle-outline",
    },
    ...collection.lists.map((list) => ({
      id: `list:${list.id}` as Filter,
      label: list.name,
      count: list.placeIds.length,
      icon: "list-outline" as const,
    })),
  ];
  const visible = places
    .filter((place) => {
      const matchesList =
        filter === "discover" ||
        (filter === "want" &&
          collection.saved.includes(place.id) &&
          !collection.visited.includes(place.id)) ||
        (filter === "visited" && collection.visited.includes(place.id)) ||
        activeList?.placeIds.includes(place.id);
      return (
        matchesList &&
        (category === "All" || place.category === category) &&
        `${place.name} ${place.category} ${place.cuisine ?? ""} ${place.neighborhood} ${place.address}`
          .toLowerCase()
          .includes(query.trim().toLowerCase())
      );
    })
    .sort(
      (a, b) =>
        (recommendations.get(b.id)?.score ?? 0) -
        (recommendations.get(a.id)?.score ?? 0),
    );

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
    setFilter(`list:${id}`);
    setQuery("");
    setCategory("All");
    setCreating(false);
    setListName("");
    setFormError("");
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 16 }]}>
      <FlatList
        data={visible}
        keyExtractor={(place) => place.id}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 112 },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headingRow}>
              <View style={styles.flex}>
                <Text style={styles.eyebrow}>YOUR NEXT GOOD MEAL</Text>
                <Text accessibilityRole="header" style={styles.title}>
                  Restaurants
                </Text>
              </View>
              <View style={styles.brand}>
                <Icon
                  name="restaurant-outline"
                  color={colors.accent}
                  size={25}
                />
              </View>
            </View>
            <Text style={styles.intro}>
              Suggested places favor great ratings (60%) and fewer reviews
              (40%). Rate a place from its map card.
            </Text>
            <View style={styles.summary}>
              <View style={styles.flex}>
                <Text style={styles.stat}>{wantCount}</Text>
                <Text style={styles.small}>Want to try</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.stat}>{collection.visited.length}</Text>
                <Text style={styles.small}>Visited</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.stat}>{collection.lists.length}</Text>
                <Text style={styles.small}>Your lists</Text>
              </View>
            </View>
            {storageError ? (
              <Text accessibilityRole="alert" style={styles.notice}>
                {storageError}
              </Text>
            ) : null}
            <View style={styles.sectionRow}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Your food journal
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCreating(true);
                  setFormError("");
                }}
                style={({ pressed }) => [
                  styles.textButton,
                  pressed && styles.pressed,
                ]}
              >
                <Icon name="add" color={colors.accent} />
                <Text style={styles.actionText}>New list</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
              keyboardShouldPersistTaps="handled"
            >
              {options.map((option) => (
                <Pressable
                  key={option.id}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: filter === option.id }}
                  accessibilityLabel={`${option.label}, ${option.count} places`}
                  onPress={() => setFilter(option.id)}
                  style={({ pressed }) => [
                    styles.listChip,
                    filter === option.id && styles.activeChip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={option.icon}
                    color={filter === option.id ? colors.white : colors.accent}
                    size={18}
                  />
                  <Text
                    style={[
                      styles.chipText,
                      filter === option.id && styles.activeText,
                    ]}
                  >
                    {option.label} · {option.count}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.search}>
              <Icon name="search-outline" color={colors.muted} />
              <TextInput
                accessibilityLabel="Search restaurants by name, food or neighborhood"
                placeholder="Restaurant, food, neighborhood…"
                placeholderTextColor={colors.muted}
                value={query}
                onChangeText={setQuery}
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
              {categories.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityState={{ selected: category === item }}
                  onPress={() => setCategory(item)}
                  style={({ pressed }) => [
                    styles.category,
                    category === item && styles.selectedCategory,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.small,
                      category === item && styles.actionText,
                    ]}
                  >
                    {item === "All" ? "All food" : item}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.resultsHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {filter === "discover"
                  ? "Good food, close by"
                  : filter === "want"
                    ? "On your must-try list"
                    : filter === "visited"
                      ? "Places you’ve been"
                      : activeList?.name}
              </Text>
              <Text style={styles.small}>
                {visible.length} {visible.length === 1 ? "spot" : "spots"}
              </Text>
            </View>
            <Text style={styles.caption}>
              Toronto · Fictional sample places
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.brand}>
              <Icon
                name={
                  query || category !== "All"
                    ? "search-outline"
                    : "bookmark-outline"
                }
                size={26}
                color={colors.accent}
              />
            </View>
            <Text style={styles.sectionTitle}>
              {query || category !== "All"
                ? "No matches this time"
                : filter === "visited"
                  ? "Good meals to remember"
                  : "Your next favorite goes here"}
            </Text>
            <Text style={styles.emptyCopy}>
              {query || category !== "All"
                ? "Try another food or neighborhood, or clear your filters."
                : filter === "visited"
                  ? "Mark a restaurant as visited to keep track of where you’ve eaten."
                  : "Discover a spot and save it for later. Use Lists to organize your cravings."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuery("");
                setCategory("All");
                if (!query && category === "All") setFilter("discover");
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryText}>
                {query || category !== "All"
                  ? "Clear filters"
                  : "Discover restaurants"}
              </Text>
            </Pressable>
          </View>
        }
        renderItem={({ item }) => {
          const saved = collection.saved.includes(item.id);
          const visited = collection.visited.includes(item.id);
          return (
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`View ${item.name} on map`}
                onPress={() => onShowMap(item)}
                style={({ pressed }) => [
                  styles.cardMain,
                  pressed && styles.pressed,
                ]}
              >
                <RestaurantPhoto
                  place={item}
                  recommendation={recommendations.get(item.id)}
                  style={styles.photo}
                />
                <View style={styles.flex}>
                  <Text style={styles.eyebrow}>
                    {item.category.toUpperCase()}
                  </Text>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.small}>{item.neighborhood}</Text>
                  <Text style={styles.small}>
                    {recommendationLabel(recommendations.get(item.id))}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
              <Text style={styles.note}>{item.note}</Text>
              <View style={styles.cardActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    saved
                      ? `Remove ${item.name} from saved restaurants and lists`
                      : `Save ${item.name} to want to try`
                  }
                  accessibilityState={{ selected: saved }}
                  onPress={() => dispatch({ type: "save", placeId: item.id })}
                  style={({ pressed }) => [
                    styles.cardAction,
                    saved && styles.selectedCategory,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={saved ? "bookmark" : "bookmark-outline"}
                    size={17}
                    color={colors.accent}
                  />
                  <Text style={styles.actionText}>
                    {saved ? "Saved" : "Want to try"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${visited ? "Mark as not visited" : "Mark as visited"}: ${item.name}`}
                  accessibilityState={{ selected: visited }}
                  onPress={() => dispatch({ type: "visit", placeId: item.id })}
                  style={({ pressed }) => [
                    styles.cardAction,
                    visited && styles.selectedCategory,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={
                      visited ? "checkmark-circle" : "checkmark-circle-outline"
                    }
                    size={17}
                    color={colors.accent}
                  />
                  <Text style={styles.actionText}>
                    {visited ? "Visited" : "Been here?"}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Manage lists for ${item.name}`}
                  onPress={() => setManaging(item)}
                  style={({ pressed }) => [
                    styles.cardAction,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon name="list-outline" size={17} color={colors.accent} />
                  <Text style={styles.actionText}>Lists</Text>
                </Pressable>
              </View>
            </View>
          );
        }}
      />
      <Modal
        visible={creating || !!managing}
        transparent
        animationType="none"
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
    paddingHorizontal: 20,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  flex: { flex: 1 },
  header: { gap: 16, paddingBottom: 18 },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.muted,
  },
  title: {
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: -1,
    color: colors.ink,
    marginTop: 5,
  },
  brand: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.tint,
  },
  intro: { fontSize: 14, lineHeight: 21, color: colors.muted },
  summary: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.tint,
  },
  stat: {
    fontSize: 27,
    fontWeight: "600",
    color: colors.accent,
    marginBottom: 3,
  },
  small: { fontSize: 12, lineHeight: 18, color: colors.muted },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    justifyContent: "space-between",
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: colors.ink,
    flexShrink: 1,
  },
  textButton: {
    minHeight: 48,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  actionText: { fontSize: 12, fontWeight: "600", color: colors.accent },
  chips: { flexDirection: "row", gap: 8 },
  listChip: {
    minHeight: 48,
    paddingHorizontal: 15,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: colors.white,
  },
  activeChip: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "600", color: colors.ink },
  activeText: { color: colors.white },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 16,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.ink,
    paddingVertical: 15,
    minHeight: 52,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  category: {
    minHeight: 44,
    paddingHorizontal: 14,
    justifyContent: "center",
    borderRadius: 14,
  },
  selectedCategory: { backgroundColor: colors.tint },
  resultsHeading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  caption: { fontSize: 11, color: colors.muted, marginTop: -8 },
  card: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
    gap: 13,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    minHeight: 80,
  },
  photo: {
    width: 76,
    height: 80,
    borderRadius: 15,
    backgroundColor: colors.tint,
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
    marginVertical: 4,
  },
  note: { fontSize: 13, lineHeight: 20, color: colors.muted },
  cardActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  cardAction: {
    flexGrow: 1,
    minHeight: 48,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  empty: { alignItems: "center", paddingVertical: 28, gap: 16 },
  emptyCopy: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.muted,
    textAlign: "center",
    maxWidth: 300,
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
  notice: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.ink,
    backgroundColor: colors.tint,
    borderRadius: 12,
    padding: 12,
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
});
