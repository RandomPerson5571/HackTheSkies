import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { TrophyArt } from "../../profile/components/RewardArt";
import { CiboLogo } from "../../../components/CiboLogo";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type Place } from "../../restaurants/data/places";
import { buildRecommendations } from "../../restaurants/models/recommendations";
import { RestaurantPhoto } from "../../restaurants/components/RestaurantPhoto";
import { colors } from "../../../theme/index";
import type {
  CollectionAction,
  RestaurantCollection,
} from "../../restaurants/models/restaurantCollection";
import {
  badgeProgress,
  calculatePoints,
  cuisineBadges,
} from "../models/community";

import { useBackend } from "../../../lib/BackendProvider";
import { usePagedList } from "../../../hooks/usePagedList";
import { PagedListFooter } from "../../../components/PagedListFooter";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Props = {
  collection: RestaurantCollection;
  dispatch: Dispatch<CollectionAction>;
  storageError: string;
  onShowMap: (place: Place) => void;
};
// Card batches per page: small enough to keep first paint snappy even with the
// full 500+ catalog loaded, large enough to avoid a button on every screenful.
const RANKED_PAGE_SIZE = 30;
const RATE_PAGE_SIZE = 12;
const FRIENDS_PAGE_SIZE = 20;
const FEED_PAGE_SIZE = 10;
type Section = "favorites" | "friends" | "badges";
const Navigation = createContext<{
  section: Section;
  setSection: (section: Section) => void;
} | null>(null);

const sections: Section[] = ["favorites", "friends", "badges"];

export function CommunityScreen(props: Props) {
  const { width } = useWindowDimensions();
  const [section, setSection] = useState<Section>("favorites");
  const index = sections.indexOf(section);
  const [offset] = useState(() => new Animated.Value(index));
  useEffect(() => {
    Animated.timing(offset, {
      toValue: index,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [index, offset]);
  const translateX = offset.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, -width, -2 * width],
  });
  return (
    <Navigation.Provider value={{ section, setSection }}>
      <View style={{ flex: 1, overflow: "hidden" }}>
        <Animated.View
          style={{
            flex: 1,
            flexDirection: "row",
            width: width * sections.length,
            transform: [{ translateX }],
          }}
        >
          <View style={{ width }}>
            <FavoritesScreen {...props} />
          </View>
          <View style={{ width }}>
            <FriendsScreen {...props} />
          </View>
          <View style={{ width }}>
            <AchievementsScreen {...props} />
          </View>
        </Animated.View>
      </View>
    </Navigation.Provider>
  );
}

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

function Action({
  label,
  onPress,
  icon,
  disabled = false,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, selected }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        selected && s.selectedButton,
        (pressed || disabled) && s.dim,
      ]}
    >
      {icon && <Icon name={icon} size={18} />}
      <Text style={s.buttonText}>{label}</Text>
    </Pressable>
  );
}

function Page({
  title,
  eyebrow,
  intro,
  icon,
  error,
  children,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  icon: IconName;
  error: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const navigation = useContext(Navigation);
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[
        s.content,
        { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 115 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={s.brandHeader}>
        <CiboLogo />
        <View style={s.brand}>
          <Icon name={icon} size={26} />
        </View>
      </View>
      <View style={s.heading}>
        <View style={s.flex}>
          <Text style={s.eyebrow}>{eyebrow}</Text>
          <Text accessibilityRole="header" style={s.title}>
            {title}
          </Text>
        </View>
        <Text style={s.intro}>{intro}</Text>
      </View>
      {navigation && (
        <View accessibilityRole="tablist" style={s.tabs}>
          {(["favorites", "friends", "badges"] as const).map((section) => (
            <Pressable
              key={section}
              accessibilityRole="tab"
              accessibilityState={{ selected: navigation.section === section }}
              onPress={() => navigation.setSection(section)}
              style={({ pressed }) => [
                s.tab,
                navigation.section === section && s.selectedTab,
                pressed && s.dim,
              ]}
            >
              <Icon
                name={
                  section === "favorites"
                    ? "heart-outline"
                    : section === "friends"
                      ? "people-outline"
                      : "ribbon-outline"
                }
                size={18}
              />
              <Text style={s.tabText}>
                {section === "favorites"
                  ? "Favorites"
                  : section === "friends"
                    ? "Friends"
                    : "Badges"}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={s.notice}>
          {error}
        </Text>
      ) : null}
      {children}
    </ScrollView>
  );
}

export function FavoritesScreen({
  collection,
  dispatch,
  storageError,
  onShowMap,
}: Props) {
  const { places } = useBackend();
  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [places, collection.ratings],
  );
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const ranked = collection.favorites.flatMap((id) => {
    const place = places.find((item) => item.id === id);
    return place ? [place] : [];
  });
  const unrated = places.filter(
    (place) =>
      !collection.ratings[place.id] &&
      `${place.name} ${place.category}`
        .toLowerCase()
        .includes(query.toLowerCase().trim()),
  );
  const rankedPage = usePagedList(ranked, RANKED_PAGE_SIZE);
  const unratedPage = usePagedList(unrated, RATE_PAGE_SIZE, query);

  function ratingCard(place: Place, rank?: number) {
    const rating = collection.ratings[place.id] ?? 0;
    const isRanked = rank !== undefined;
    return (
      <View key={place.id} style={fs.card}>
        <View style={s.row}>
          {isRanked && (
            <View style={fs.rankBadge}>
              <Text style={fs.rankText}>#{rank + 1}</Text>
            </View>
          )}
          <RestaurantPhoto
            place={place}
            recommendation={recommendations.get(place.id)}
            style={fs.photo}
          />
          <View style={s.flex}>
            <Text style={s.eyebrow}>{place.category.toUpperCase()}</Text>
            <Text style={s.name}>{place.name}</Text>
            <Text style={s.small}>{place.neighborhood}</Text>
          </View>
          {isRanked ? (
            <View style={fs.ratingPill}>
              <Icon name={rating ? "star" : "star-outline"} size={15} />
              <Text style={fs.ratingPillText}>
                {rating ? `${rating}/5` : "Unrated"}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={fs.stars}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={`Rate ${place.name} ${value} ${value === 1 ? "star" : "stars"}`}
              accessibilityState={{ selected: value === rating }}
              onPress={() =>
                dispatch({ type: "rate", placeId: place.id, rating: value })
              }
              style={({ pressed }) => [fs.star, pressed && s.dim]}
            >
              <Icon
                name={value <= rating ? "star" : "star-outline"}
                size={24}
              />
            </Pressable>
          ))}
          <Text style={s.small}>{rating ? `${rating}/5` : "Unrated"}</Text>
        </View>
        <View style={s.actions}>
          {isRanked && (
            <>
              <Action
                label="Up"
                icon="arrow-up"
                disabled={rank === 0}
                onPress={() =>
                  dispatch({ type: "rank", placeId: place.id, direction: -1 })
                }
              />
              <Action
                label="Down"
                icon="arrow-down"
                disabled={rank === ranked.length - 1}
                onPress={() =>
                  dispatch({ type: "rank", placeId: place.id, direction: 1 })
                }
              />
              <Action
                label="Clear"
                onPress={() =>
                  dispatch({ type: "rate", placeId: place.id, rating: 0 })
                }
              />
            </>
          )}
          <Action
            label="Map"
            icon="map-outline"
            onPress={() => onShowMap(place)}
          />
        </View>
      </View>
    );
  }
  return (
    <Page
      title="Your favorites."
      eyebrow="THE ONES WORTH GOING BACK FOR"
      intro="Rate your bites, then put your favorites in order. Your ranking is yours to make."
      icon="heart-outline"
      error={storageError}
    >
      <View style={fs.hero}>
        <View style={fs.heroIcon}>
          <Icon name="podium-outline" size={28} />
        </View>
        <View style={fs.heroCopy}>
          <Text style={fs.heroNumber}>{ranked.length} ranked</Text>
          <Text style={s.small}>Your personal leaderboard.</Text>
        </View>
      </View>
      <Text accessibilityRole="header" style={s.section}>
        Your ranking
      </Text>
      <Text style={s.small}>
        Use the arrows to rank independently of your star ratings.
      </Text>
      {!ranked.length && (
        <View style={s.empty}>
          <Icon name="heart-outline" size={32} />
          <Text style={s.name}>Every favorite starts with a bite.</Text>
          <Text style={s.small}>Rate a spot below to start your ranking.</Text>
        </View>
      )}
      {rankedPage.visible.map((place, index) =>
        ratingCard(place, rankedPage.offset + index),
      )}
      <PagedListFooter
        noun="ranked spots"
        hasMore={rankedPage.hasMore}
        shown={rankedPage.shown}
        total={rankedPage.total}
        remaining={rankedPage.remaining}
        onLoadMore={rankedPage.loadMore}
      />
      <Text accessibilityRole="header" style={s.section}>
        Tried something good?
      </Text>
      <Text style={s.small}>
        Rating a spot also marks it as visited and saves it to your journal.
      </Text>
      <TextInput
        accessibilityLabel="Search places to rate"
        placeholder="Find a spot to rate…"
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
        style={[s.input, searchFocused && s.searchActive]}
      />
      {unratedPage.visible.map((place) => ratingCard(place))}
      <PagedListFooter
        noun="spots"
        hasMore={unratedPage.hasMore}
        shown={unratedPage.shown}
        total={unratedPage.total}
        remaining={unratedPage.remaining}
        onLoadMore={unratedPage.loadMore}
      />
      {!unrated.length && (
        <Text style={s.notice}>
          {query
            ? "No unrated spots match your search."
            : "You’ve rated every sample spot. Your next favorite is out there."}
        </Text>
      )}
    </Page>
  );
}

export function FriendsScreen({
  collection,
  dispatch,
  storageError,
  onShowMap,
}: Props) {
  const { places, friends: sampleFriends } = useBackend();
  const recommendations = useMemo(
    () => buildRecommendations(places, collection.ratings),
    [places, collection.ratings],
  );
  const [mode, setMode] = useState<"activity" | "find">("activity");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const friends = sampleFriends.filter((friend) =>
    collection.friendIds.includes(friend.id),
  );
  const activeFriends = filter
    ? friends.filter((friend) => friend.id === filter)
    : friends;
  const matches = sampleFriends.filter((friend) =>
    `${friend.name} ${friend.handle}`
      .toLowerCase()
      .includes(query.toLowerCase().trim()),
  );
  const matchesPage = usePagedList(matches, FRIENDS_PAGE_SIZE, query);
  const feed = activeFriends.flatMap((friend) =>
    friend.visits.flatMap((visit) => {
      const place = places.find((item) => item.id === visit.placeId);
      if (!place) return [];
      return [{ key: `${friend.id}-${visit.placeId}`, friend, place, visit }];
    }),
  );
  const feedPage = usePagedList(
    feed,
    FEED_PAGE_SIZE,
    `${filter ?? "everyone"}:${friends.length}`,
  );
  return (
    <Page
      title="Better with friends."
      eyebrow="GOOD TASTE, GOOD COMPANY"
      intro="Keep up with your people and find the spots they’re loving."
      icon="people-outline"
      error={storageError}
    >
      <Text style={s.notice}>
        Sample community · These profiles and visits are fictional. Adding a
        friend saves them to your private food journal.
      </Text>
      <View style={s.actions}>
        <Action
          label={`Activity · ${friends.length} friends`}
          selected={mode === "activity"}
          onPress={() => setMode("activity")}
          icon="time-outline"
        />
        <Action
          label="Add friends"
          selected={mode === "find"}
          onPress={() => setMode("find")}
          icon="person-add-outline"
        />
      </View>
      {mode === "find" ? (
        <>
          <TextInput
            accessibilityLabel="Search sample friends by name or handle"
            placeholder="Search a name or handle…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={[s.input, searchFocused && s.searchActive]}
            autoCapitalize="none"
          />

          <Text accessibilityRole="header" style={s.section}>
            Find your food people
          </Text>
          {matchesPage.visible.map((friend) => {
            const added = collection.friendIds.includes(friend.id);
            return (
              <View key={friend.id} style={s.card}>
                <View style={s.row}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{friend.initials}</Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.name}>{friend.name}</Text>
                    <Text style={s.small}>{friend.handle}</Text>
                  </View>
                </View>
                <Text style={s.small}>{friend.bio}</Text>
                <Action
                  label={added ? `Remove ${friend.name}` : `Add ${friend.name}`}
                  icon={
                    added ? "checkmark-circle-outline" : "person-add-outline"
                  }
                  selected={added}
                  onPress={() => {
                    dispatch({ type: "friend", friendId: friend.id });
                    if (filter === friend.id) setFilter(null);
                  }}
                />
              </View>
            );
          })}
          {!matches.length && (
            <Text style={s.notice}>
              No sample profiles match. Try Maya, Alex, or Sam.
            </Text>
          )}
          <PagedListFooter
            noun="friends"
            hasMore={matchesPage.hasMore}
            shown={matchesPage.shown}
            total={matchesPage.total}
            remaining={matchesPage.remaining}
            onLoadMore={matchesPage.loadMore}
          />
        </>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.actions}
          >
            <Action
              label="Everyone"
              selected={filter === null}
              onPress={() => setFilter(null)}
            />
            {friends.map((friend) => (
              <Action
                key={friend.id}
                label={friend.name.split(" ")[0]!}
                selected={filter === friend.id}
                onPress={() => setFilter(friend.id)}
              />
            ))}
          </ScrollView>
          <Text accessibilityRole="header" style={s.section}>
            Where they’ve been
          </Text>
          {!friends.length && (
            <View style={s.empty}>
              <Icon name="people-outline" size={34} />
              <Text style={s.name}>A table for more than one.</Text>
              <Text style={s.small}>
                Add a sample friend to explore their visits and ratings.
              </Text>
              <Action
                label="Find friends"
                icon="person-add-outline"
                onPress={() => setMode("find")}
              />
            </View>
          )}
          {feedPage.visible.map(({ key, friend, place, visit }) => {
            return (
              <View key={key} style={s.card}>
                <View style={s.row}>
                  <View style={s.avatar}>
                    <Text style={s.avatarText}>{friend.initials}</Text>
                  </View>
                  <View style={s.flex}>
                    <Text style={s.name}>{friend.name}</Text>
                    <Text style={s.small}>
                      Visited · {visit.when} · Sample activity
                    </Text>
                  </View>
                </View>
                <RestaurantPhoto
                  place={place}
                  recommendation={recommendations.get(place.id)}
                  style={s.feedPhoto}
                />
                <View style={s.row}>
                  <Text style={[s.name, s.flex]}>{place.name}</Text>
                  <Icon name="star" size={16} />
                  <Text style={s.buttonText}>{visit.rating}/5</Text>
                </View>
                <Text style={s.small}>
                  {place.category} · {place.neighborhood}
                </Text>
                <Text style={s.quote}>“{visit.note}”</Text>
                <View style={s.actions}>
                  <Action
                    label="View on map"
                    icon="map-outline"
                    onPress={() => onShowMap(place)}
                  />
                  <Action
                    label={
                      collection.saved.includes(place.id)
                        ? "Saved"
                        : "Want to try"
                    }
                    selected={collection.saved.includes(place.id)}
                    icon="bookmark-outline"
                    onPress={() =>
                      dispatch({ type: "save", placeId: place.id })
                    }
                  />
                </View>
              </View>
            );
          })}
          <PagedListFooter
            noun="visits"
            hasMore={feedPage.hasMore}
            shown={feedPage.shown}
            total={feedPage.total}
            remaining={feedPage.remaining}
            onLoadMore={feedPage.loadMore}
          />
        </>
      )}
    </Page>
  );
}

export function AchievementsScreen({
  collection,
  storageError,
  onShowMap,
}: Props) {
  const { places } = useBackend();
  const [filter, setFilter] = useState<"all" | "earned" | "progress">("all");
  const badges = cuisineBadges.map((badge) => ({
    ...badge,
    count: badgeProgress(badge.category, collection.visited, places),
  }));
  const points = calculatePoints(collection.visited, places);
  const visible = badges.filter(
    (badge) =>
      filter === "all" ||
      (filter === "earned"
        ? badge.count >= badge.goal
        : badge.count < badge.goal),
  );
  return (
    <Page
      title="A taste for adventure."
      eyebrow="YOUR CUISINE PASSPORT"
      intro="Little rewards for following your appetite. Visit different spots to build your collection."
      icon="ribbon-outline"
      error={storageError}
    >
      <View style={s.hero}>
        <TrophyArt id="gourmet" size={64} />
        <View style={s.flex}>
          <Text style={s.heroNumber}>{points.toLocaleString()} points</Text>
          <Text style={s.small}>
            {collection.visited.length} spots visited · Plenty more to taste
          </Text>
        </View>
      </View>
      <Text style={s.small}>
        Each different restaurant counts once. Mark it Visited in Restaurants or
        give it a rating to earn progress.
      </Text>
      <View style={s.actions}>
        {(["all", "earned", "progress"] as const).map((item) => (
          <Action
            key={item}
            label={
              item === "all"
                ? "All badges"
                : item === "earned"
                  ? "Earned"
                  : "In progress"
            }
            selected={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </View>
      {visible.map((badge) => {
        const unlocked = badge.count >= badge.goal;
        const next = places.find(
          (place) =>
            place.category === badge.category &&
            !collection.visited.includes(place.id),
        );
        return (
          <View key={badge.id} style={[s.card, unlocked && s.earnedCard]}>
            <View style={s.row}>
              <TrophyArt id={badge.id} size={80} locked={!unlocked} />
              <View style={s.flex}>
                <Text style={s.eyebrow}>
                  {unlocked ? "EARNED" : "IN PROGRESS"}
                </Text>
                <Text style={s.name}>{badge.name}</Text>
              </View>
              <Icon
                name={unlocked ? "checkmark-circle" : "lock-closed-outline"}
              />
            </View>
            <Text style={s.small}>{badge.description}</Text>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`${badge.name} progress`}
              accessibilityValue={{
                min: 0,
                max: badge.goal,
                now: Math.min(badge.count, badge.goal),
                text: `${Math.min(badge.count, badge.goal)} of ${badge.goal} spots visited`,
              }}
              style={s.track}
            >
              <View
                style={[
                  s.fill,
                  { width: `${Math.min(badge.count / badge.goal, 1) * 100}%` },
                ]}
              />
            </View>
            <Text style={s.buttonText}>
              {Math.min(badge.count, badge.goal)} / {badge.goal} different spots
              visited
            </Text>
            {unlocked ? (
              <Text style={s.small}>One for the passport. Keep exploring!</Text>
            ) : (
              next && (
                <Action
                  label={`Try ${next.name}`}
                  icon="arrow-forward-outline"
                  onPress={() => onShowMap(next)}
                />
              )
            )}
          </View>
        );
      })}
      {!visible.length && (
        <View style={s.empty}>
          <Icon name="ribbon-outline" size={34} />
          <Text style={s.name}>
            {filter === "earned"
              ? "Your first badge is one bite away."
              : "Passport complete!"}
          </Text>
          <Text style={s.small}>
            {filter === "earned"
              ? "Start with a Japanese or pizza spot to earn your first badge."
              : "You’ve earned every badge in this sample collection."}
          </Text>
          <Action label="See all badges" onPress={() => setFilter("all")} />
        </View>
      )}
    </Page>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 20,
  },
  flex: { flex: 1, minWidth: 0 },
  brandHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  heading: { gap: 10 },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: colors.muted,
  },
  title: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700",
    letterSpacing: -1,
    color: colors.ink,
    marginTop: 5,
  },
  intro: { fontSize: 14, lineHeight: 22, color: colors.muted, maxWidth: 520 },
  brand: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  section: { fontSize: 20, fontWeight: "600", color: colors.ink, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  hero: {
    backgroundColor: colors.tint,
    borderRadius: 22,
    padding: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  heroNumber: {
    fontSize: 24,
    fontWeight: "600",
    color: colors.accent,
    marginBottom: 5,
  },
  card: {
    borderRadius: 22,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
    color: colors.ink,
    marginVertical: 3,
  },
  small: { fontSize: 12, lineHeight: 19, color: colors.muted },
  photo: {
    width: 60,
    height: 66,
    borderRadius: 13,
    backgroundColor: colors.tint,
  },
  feedPhoto: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    backgroundColor: colors.tint,
  },
  rank: { fontSize: 23, fontWeight: "700", color: colors.accent },
  stars: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  star: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    borderRadius: 18,
    backgroundColor: colors.border,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  selectedTab: { backgroundColor: colors.tint },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.ink,
    flexShrink: 1,
    textAlign: "center",
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  button: {
    minHeight: 48,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.white,
  },
  selectedButton: { backgroundColor: colors.tint, borderColor: colors.accent },
  buttonText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.accent,
    flexShrink: 1,
  },
  dim: { opacity: 0.45 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 15,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.white,
  },
  searchActive: {
    borderColor: colors.accent,
    backgroundColor: colors.tint,
  },
  notice: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: colors.tint,
    fontSize: 12,
    lineHeight: 19,
    color: colors.muted,
  },
  empty: { alignItems: "center", paddingVertical: 26, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.tint,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: colors.accent },
  quote: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  earnedCard: { borderColor: colors.accent },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: colors.tint,
  },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.accent },
});

const fs = StyleSheet.create({
  card: {
    borderRadius: 22,
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  rankBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 15, fontWeight: "700", color: colors.accent },
  photo: {
    width: 56,
    height: 62,
    borderRadius: 12,
    backgroundColor: colors.tint,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.tint,
  },
  ratingPillText: { fontSize: 12, fontWeight: "700", color: colors.accent },
  stars: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 2,
  },
  star: {
    minWidth: 40,
    minHeight: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  hero: {
    backgroundColor: colors.tint,
    borderRadius: 22,
    padding: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
  },
  heroNumber: {
    fontSize: 22,
    fontWeight: "600",
    color: colors.accent,
    marginBottom: 3,
  },
  heroCopy: { flex: 1, minWidth: 0, gap: 4 },
});
