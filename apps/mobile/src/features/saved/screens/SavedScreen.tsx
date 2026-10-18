import { useMenuSound } from "../../../hooks/useMenuSound";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { useMemo, useState } from "react";
import {
  FlatList,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../../theme";
import MapView from "../../../components/maps";
import { mapCenter, type Place } from "../../restaurants/data/places";
import { RestaurantPhoto } from "../../restaurants/components/RestaurantPhoto";
import type {
  CollectionAction,
  RestaurantCollection,
} from "../../restaurants/models/restaurantCollection";
import { useQuests } from "../../quests/hooks/useQuests";
import { questsFor } from "../../quests/models/quests";

function randomPlaceId(places: Place[]) {
  return places[Math.floor(Math.random() * places.length)]?.id ?? null;
}

type IconName = React.ComponentProps<typeof Ionicons>["name"];
function Action({
  label,
  icon,
  onPress,
  selected = false,
  disabled = false,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  selected?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        selected && styles.actionSelected,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Ionicons accessible={false} name={icon} size={19} color={colors.ink} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

export function SavedScreen({
  places,
  collection,
  dispatch,
  storageError,
  onBack,
  onDiscover,
  onShowMap,
  onOpenQuests,
}: {
  places: Place[];
  collection: RestaurantCollection;
  dispatch: (action: CollectionAction) => void;
  storageError: string;
  onBack: () => void;
  onDiscover: () => void;
  onShowMap: (place: Place) => void;
  onOpenQuests: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "want" | "visited">("all");
  const [listId, setListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [map, setMap] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  useMenuSound(creating);
  useMenuSound(editing !== null);
  useMenuSound(map);

  const quests = useQuests();
  const activeQuest = quests.ready
    ? questsFor(quests.state.selectedCuisine).find(
        (quest) => !quests.state.completed.includes(quest.id),
      )
    : undefined;
  const saved = useMemo(
    () => places.filter((place) => collection.saved.includes(place.id)),
    [places, collection.saved],
  );
  const visited = new Set(collection.visited);
  const selectedList = collection.lists.find((list) => list.id === listId);
  const filtered = saved.filter(
    (place) =>
      (status === "all" ||
        (status === "visited"
          ? visited.has(place.id)
          : !visited.has(place.id))) &&
      (!selectedList || selectedList.placeIds.includes(place.id)) &&
      `${place.name} ${place.cuisine ?? ""} ${place.neighborhood} ${place.address}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  const picked = filtered.find((place) => place.id === pickedId);
  const candidates = filtered.filter((place) => !visited.has(place.id));
  const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  const emptyRecommendations = useMemo(() => new Map(), []);
  function createList() {
    const trimmed = name.trim();
    if (!trimmed) {
      setNotice("Give your collection a name.");
      return;
    }
    if (
      collection.lists.some(
        (list) => list.name.toLowerCase() === trimmed.toLowerCase(),
      )
    ) {
      setNotice("You already have a collection with that name.");
      return;
    }
    dispatch({
      type: "create-list",
      id: `saved-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: trimmed,
    });
    setName("");
    setCreating(false);
    setNotice(`Created ${trimmed}. Use Organize on a place to add it.`);
  }
  async function shareList() {
    const items = selectedList
      ? saved.filter((place) => selectedList.placeIds.includes(place.id))
      : filtered;
    const message = `${selectedList?.name ?? "My Cibo saved places"}\n\n${items.map((place) => `${place.name}\n${place.address}`).join("\n\n")}`;
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(message);
        setNotice("Collection copied. Paste it into a message to share.");
      } else {
        await Share.share({ message });
      }
    } catch {
      setNotice("Couldn’t share this collection. Please try again.");
    }
  }
  function placeCard(place: Place) {
    const isVisited = visited.has(place.id);
    return (
      <View style={styles.placeCard}>
        <View style={styles.placeTop}>
          <RestaurantPhoto
            place={place}
            recommendation={undefined}
            showAll
            style={styles.placePhoto}
          />
          <View style={styles.flex}>
            <Text style={styles.placeName}>{place.name}</Text>
            <Text style={styles.copy}>
              {place.cuisine ?? place.category} · {place.neighborhood}
            </Text>
            <Text style={styles.photoCaption}>
              {place.photo?.kind === "illustration"
                ? "Cuisine inspiration"
                : "Restaurant photo"}
            </Text>
          </View>
        </View>
        {activeQuest && place.cuisine === activeQuest.cuisine && (
          <Pressable
            accessibilityRole="button"
            onPress={onOpenQuests}
            style={({ pressed }) => [
              styles.questHint,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              accessible={false}
              name="flag-outline"
              size={16}
              color={colors.accent}
            />
            <Text style={styles.actionText}>
              Explore your {activeQuest.cuisine} quest here
            </Text>
            <Ionicons
              accessible={false}
              name="chevron-forward"
              size={14}
              color={colors.accent}
            />
          </Pressable>
        )}
        <View style={styles.actions}>
          <Action
            label={isVisited ? "Visited" : "Want to Try"}
            icon={isVisited ? "checkmark-circle" : "time-outline"}
            selected={isVisited}
            onPress={() => dispatch({ type: "visit", placeId: place.id })}
          />
          <Action
            label="Organize"
            icon="folder-outline"
            selected={editing === place.id}
            onPress={() => setEditing(editing === place.id ? null : place.id)}
          />
          <Action
            label="On map"
            icon="location-outline"
            onPress={() => onShowMap(place)}
          />
        </View>
        {editing === place.id && (
          <View style={styles.organizer}>
            <Text style={styles.smallTitle}>Add to collections</Text>
            {collection.lists.length ? (
              collection.lists.map((list) => (
                <Action
                  key={list.id}
                  label={list.name}
                  icon={
                    list.placeIds.includes(place.id)
                      ? "checkbox"
                      : "square-outline"
                  }
                  selected={list.placeIds.includes(place.id)}
                  onPress={() =>
                    dispatch({
                      type: "membership",
                      placeId: place.id,
                      listId: list.id,
                    })
                  }
                />
              ))
            ) : (
              <Text style={styles.copy}>
                Create a collection above to start organizing.
              </Text>
            )}
            <Action
              label="Remove from Saved"
              icon="bookmark-outline"
              onPress={() => {
                dispatch({ type: "save", placeId: place.id });
                setEditing(null);
              }}
            />
          </View>
        )}
      </View>
    );
  }
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 118 },
      ]}
      data={map && token && !mapFailed ? [] : filtered}
      keyExtractor={(place) => place.id}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => placeCard(item)}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.headingRow}>
            <Action label="Back" icon="arrow-back" onPress={onBack} />
            <Text style={styles.eyebrow}>YOUR FOOD WISHLIST</Text>
          </View>
          <View>
            <Text accessibilityRole="header" style={styles.title}>
              Your Saved Places
            </Text>
            <Text style={styles.subtitle}>
              Good finds. Future plans. All yours.
            </Text>
          </View>
          <View style={styles.search}>
            <Ionicons
              accessible={false}
              name="search-outline"
              color={colors.muted}
              size={20}
            />
            <TextInput
              accessibilityLabel="Search saved restaurants"
              placeholder="Search saved restaurants…"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
            />
            {query ? (
              <Action label="Clear" icon="close" onPress={() => setQuery("")} />
            ) : null}
          </View>
          <View style={styles.stats}>
            {(
              [
                {
                  label: "Want to Try",
                  value: saved.filter((place) => !visited.has(place.id)).length,
                  key: "want",
                  icon: "bookmark-outline",
                },
                {
                  label: "Visited",
                  value: saved.filter((place) => visited.has(place.id)).length,
                  key: "visited",
                  icon: "checkmark-circle-outline",
                },
                {
                  label: "Collections",
                  value: collection.lists.length,
                  key: "all",
                  icon: "albums-outline",
                },
              ] as const
            ).map((stat) => (
              <Pressable
                key={stat.key}
                accessibilityRole="button"
                accessibilityLabel={`${stat.value} ${stat.label}`}
                accessibilityState={{
                  selected: stat.key !== "all" && status === stat.key,
                }}
                onPress={() => {
                  setStatus(stat.key);
                  setListId(null);
                }}
                style={({ pressed }) => [
                  styles.stat,
                  stat.key !== "all" &&
                    status === stat.key &&
                    styles.statActive,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  accessible={false}
                  name={stat.icon}
                  color={colors.ink}
                  size={21}
                />
                <Text style={styles.statNumber}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sectionHeading}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Your collections
            </Text>
            <Action
              label="New"
              icon="add"
              selected={creating}
              onPress={() => {
                setCreating(!creating);
                setNotice("");
              }}
            />
          </View>
          {creating && (
            <View style={styles.createBox}>
              <Text style={styles.smallTitle}>
                A little list for your next adventure
              </Text>
              <TextInput
                autoFocus
                accessibilityLabel="Collection name"
                placeholder="Date nights, sushi spots…"
                placeholderTextColor={colors.muted}
                maxLength={40}
                value={name}
                onChangeText={setName}
                onSubmitEditing={createList}
                style={styles.nameInput}
              />
              <View style={styles.actions}>
                <Action
                  label="Create collection"
                  icon="checkmark"
                  onPress={createList}
                />
                <Action
                  label="Cancel"
                  icon="close"
                  onPress={() => setCreating(false)}
                />
              </View>
            </View>
          )}
          {collection.lists.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.collectionRow}
            >
              {collection.lists.map((list) => {
                const cover = saved.find((place) =>
                  list.placeIds.includes(place.id),
                );
                return (
                  <Pressable
                    key={list.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${list.name}, ${list.placeIds.length} places`}
                    accessibilityState={{ selected: listId === list.id }}
                    onPress={() => {
                      setListId(listId === list.id ? null : list.id);
                      setStatus("all");
                    }}
                    style={({ pressed }) => [
                      styles.collectionCard,
                      listId === list.id && styles.collectionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {cover ? (
                      <RestaurantPhoto
                        place={cover}
                        recommendation={undefined}
                        showAll
                        style={styles.collectionPhoto}
                      />
                    ) : (
                      <View
                        style={[
                          styles.collectionPhoto,
                          styles.collectionPlaceholder,
                        ]}
                      >
                        <Ionicons
                          accessible={false}
                          name="albums-outline"
                          color={colors.accent}
                          size={32}
                        />
                      </View>
                    )}
                    <View style={styles.collectionText}>
                      <Text style={styles.smallTitle} numberOfLines={2}>
                        {list.name}
                      </Text>
                      <Text style={styles.copy}>
                        {list.placeIds.length} places
                        {listId === list.id ? " · Selected" : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyCollections}>
              <Ionicons
                accessible={false}
                name="albums-outline"
                size={26}
                color={colors.accent}
              />
              <Text style={styles.smallTitle}>
                A collection for every craving
              </Text>
              <Text style={styles.copy}>
                Group your finds into sushi spots, cheap eats, or date nights.
              </Text>
            </View>
          )}
          <View style={styles.picker}>
            <View style={styles.flex}>
              <Text style={styles.smallTitle}>Where should I eat?</Text>
              <Text style={styles.copy}>Let a saved spot surprise you.</Text>
            </View>
            <Action
              label="Pick for me"
              icon="shuffle"
              disabled={!candidates.length}
              onPress={() => {
                const pool =
                  candidates.length > 1
                    ? candidates.filter((place) => place.id !== pickedId)
                    : candidates;
                setPickedId(randomPlaceId(pool));
              }}
            />
          </View>
          {picked && (
            <View
              style={[styles.placeCard, styles.spotlight]}
              accessibilityLiveRegion="polite"
            >
              <Text style={styles.eyebrow}>TONIGHT’S PICK</Text>
              <Text style={styles.placeName}>{picked.name}</Text>
              <Text style={styles.copy}>
                {picked.cuisine ?? picked.category} · {picked.neighborhood}
              </Text>
              <Action
                label="See this place on the map"
                icon="location-outline"
                onPress={() => onShowMap(picked)}
              />
            </View>
          )}
          <View style={styles.sectionHeading}>
            <View style={styles.flex}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                {selectedList?.name ?? "Saved restaurants"}
              </Text>
              <Text style={styles.copy}>
                {filtered.length} places
                {status === "want"
                  ? " to try"
                  : status === "visited"
                    ? " visited"
                    : " in your wishlist"}
              </Text>
            </View>
            <View style={styles.actions}>
              <Action
                label={map ? "List" : "Map"}
                icon={map ? "list-outline" : "map-outline"}
                onPress={() => {
                  setMap(!map);
                  setMapFailed(false);
                }}
              />
              <Action
                label="Share"
                icon="share-outline"
                disabled={!filtered.length && !selectedList?.placeIds.length}
                onPress={() => void shareList()}
              />
            </View>
          </View>
          {(query || listId || status !== "all") && (
            <Action
              label="Show all saved places"
              icon="close-circle-outline"
              onPress={() => {
                setQuery("");
                setStatus("all");
                setListId(null);
              }}
            />
          )}
          {storageError ? (
            <Text accessibilityRole="alert" style={styles.copy}>
              {storageError}
            </Text>
          ) : null}
          {notice ? (
            <Text accessibilityLiveRegion="polite" style={styles.copy}>
              {notice}
            </Text>
          ) : null}
          {map && filtered.length > 0 && token && !mapFailed && (
            <View style={styles.map}>
              <MapView
                token={token}
                places={filtered}
                center={filtered[0]?.coordinate ?? mapCenter}
                zoom={11}
                topInset={0}
                bottomInset={0}
                recommendations={emptyRecommendations}
                onReady={() => {}}
                onError={() => setMapFailed(true)}
                onSelect={onShowMap}
                renderPlaceMarker={(place) => (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`View ${place.name}`}
                    onPress={() => onShowMap(place)}
                    style={styles.mapPin}
                  >
                    <Ionicons
                      accessible={false}
                      name="location"
                      size={28}
                      color={colors.accent}
                    />
                    <Text style={styles.mapLabel}>{place.name}</Text>
                  </Pressable>
                )}
              />
            </View>
          )}
          {map && (!token || mapFailed) && (
            <Text accessibilityRole="alert" style={styles.copy}>
              The map is unavailable. Your saved places are listed below.
            </Text>
          )}
        </View>
      }
      ListEmptyComponent={
        map && token && !mapFailed && filtered.length ? null : (
          <View style={styles.empty}>
            <Ionicons
              accessible={false}
              name="bookmark-outline"
              size={38}
              color={colors.accent}
            />
            <Text style={styles.sectionTitle}>
              {saved.length
                ? "No places in this view yet"
                : "Your next favourite starts here"}
            </Text>
            <Text style={styles.emptyCopy}>
              {saved.length
                ? "Try a different search or filter. Add places to a collection with Organize."
                : "Bookmark a restaurant in Discover, then come back to plan your next bite."}
            </Text>
            <Action
              label="Discover restaurants"
              icon="compass-outline"
              onPress={onDiscover}
            />
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    width: "100%",
    maxWidth: 680,
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 12,
  },
  header: { gap: 20, marginBottom: 4 },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: colors.muted,
    flexShrink: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.ink,
    letterSpacing: -1,
  },
  subtitle: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 21 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: colors.ink,
    fontSize: 14,
    paddingVertical: 14,
  },
  stats: { flexDirection: "row", gap: 8 },
  stat: {
    flex: 1,
    borderRadius: 20,
    padding: 12,
    gap: 8,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statActive: { backgroundColor: colors.tint, borderColor: colors.accent },
  statNumber: { fontSize: 30, color: colors.ink, fontWeight: "800" },
  statLabel: { fontSize: 11, color: colors.ink, fontWeight: "600" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 8,
  },
  sectionTitle: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  smallTitle: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  action: {
    minHeight: 44,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.tint,
    flexShrink: 1,
  },
  actionSelected: { borderWidth: 1, borderColor: colors.accent },
  actionText: {
    color: colors.ink,
    fontWeight: "600",
    fontSize: 12,
    flexShrink: 1,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  flex: { flex: 1, minWidth: 0, gap: 4 },
  createBox: {
    gap: 12,
    padding: 16,
    borderRadius: 20,
    borderColor: colors.border,
    borderWidth: 1,
  },
  nameInput: {
    minHeight: 48,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.ink,
  },
  collectionRow: { gap: 12 },
  collectionCard: {
    width: 190,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: colors.border,
  },
  collectionSelected: { borderColor: colors.accent },
  collectionPhoto: { width: "100%", height: 116, backgroundColor: colors.tint },
  collectionPlaceholder: { alignItems: "center", justifyContent: "center" },
  collectionText: { padding: 12, gap: 4 },
  emptyCollections: {
    padding: 20,
    borderRadius: 22,
    backgroundColor: colors.tint,
    gap: 8,
  },
  picker: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    gap: 12,
  },
  placeCard: {
    borderRadius: 22,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  spotlight: { borderColor: colors.accent, borderWidth: 2 },
  placeTop: { flexDirection: "row", gap: 12, alignItems: "center" },
  placePhoto: {
    width: 76,
    height: 82,
    borderRadius: 14,
    backgroundColor: colors.tint,
  },
  placeName: { color: colors.ink, fontSize: 16, fontWeight: "700" },
  photoCaption: { color: colors.muted, fontSize: 10 },
  questHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    padding: 10,
    backgroundColor: colors.tint,
    borderRadius: 12,
  },
  organizer: {
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingTop: 12,
  },
  empty: { padding: 24, gap: 12, alignItems: "center" },
  emptyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  map: { height: 360, overflow: "hidden", borderRadius: 24 },
  mapPin: { alignItems: "center", maxWidth: 120 },
  mapLabel: {
    backgroundColor: colors.white,
    color: colors.ink,
    fontSize: 11,
    padding: 4,
    borderRadius: 6,
  },
  pressed: { opacity: 0.65 },
  disabled: { opacity: 0.5 },
});
