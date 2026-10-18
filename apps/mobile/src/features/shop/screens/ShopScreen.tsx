import { useEffect, useState, type ComponentProps } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { CiboLogo } from "../../../components/CiboLogo";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { colors, questColors } from "../../../theme";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";
import { useMenuSound } from "../../../hooks/useMenuSound";

type IconName = ComponentProps<typeof Ionicons>["name"];
const categories = ["All offers", "Coffee", "Dining", "Sweet treats"] as const;
type Category = (typeof categories)[number];
type Offer = {
  id: string;
  title: string;
  category: Category;
  value: string;
  subtitle: string;
  icon: IconName;
  background: string;
  terms: string;
};
// Preview inventory until partner offers and redemption are connected.
const offers: Offer[] = [
  {
    id: "coffee",
    title: "Your next coffee, on us",
    category: "Coffee",
    value: "FREE",
    subtitle: "A little pick-me-up for your next adventure.",
    icon: "cafe-outline",
    background: questColors.lime,
    terms:
      "One regular brewed coffee with a food purchase. Excludes specialty drinks and add-ons.",
  },
  {
    id: "dining",
    title: "Make a meal of it",
    category: "Dining",
    value: "20% OFF",
    subtitle: "Good food. Even better together.",
    icon: "restaurant-outline",
    background: questColors.peach,
    terms:
      "20% off food when you spend $25 or more, before taxes and gratuity. Maximum discount $10.",
  },
  {
    id: "bakery",
    title: "A sweeter kind of break",
    category: "Sweet treats",
    value: "2 FOR 1",
    subtitle: "One for you. One for your favourite person.",
    icon: "ice-cream-outline",
    background: questColors.lavender,
    terms:
      "Buy one pastry and receive a second of equal or lesser value. Subject to availability.",
  },
  {
    id: "lunch",
    title: "Lunch tastes better for less",
    category: "Dining",
    value: "$5 OFF",
    subtitle: "Something delicious for your lunch hour.",
    icon: "fast-food-outline",
    background: questColors.lime,
    terms:
      "$5 off a food order of $20 or more, before taxes and gratuity. One offer per visit.",
  },
];
const KEY = "cibo.shop.saved.v1";
const Icon = ({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) => <Ionicons name={name} size={size} color={color} accessible={false} />;

export function ShopScreen() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [category, setCategory] = useState<Category>("All offers");
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Offer | null>(null);
  useMenuSound(selected !== null);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(KEY)
      .then((raw) => {
        const parsed: unknown = raw ? JSON.parse(raw) : [];
        if (active && Array.isArray(parsed))
          setSaved(
            parsed.filter(
              (id): id is string =>
                typeof id === "string" &&
                offers.some((offer) => offer.id === id),
            ),
          );
      })
      .catch(() => {
        if (active)
          setError("Saved offers couldn’t load. Reopen the shop to try again.");
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggleSave(offer: Offer) {
    if (!ready || saving) return;
    setSaving(true);
    const next = saved.includes(offer.id)
      ? saved.filter((id) => id !== offer.id)
      : [...saved, offer.id];
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
      setSaved(next);
      setError("");
    } catch {
      setError("Couldn’t save this change. Please try again.");
    } finally {
      setSaving(false);
    }
  }
  const visible = offers.filter(
    (offer) =>
      (category === "All offers" || category === offer.category) &&
      (!savedOnly || saved.includes(offer.id)) &&
      `${offer.title} ${offer.category} ${offer.value}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <CiboLogo />
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>A LITTLE EXTRA, JUST FOR YOU</Text>
            <Text accessibilityRole="header" style={styles.title}>
              The Cibo shop
            </Text>
          </View>
          <View style={styles.bag}>
            <Icon name="bag-handle-outline" />
          </View>
        </View>
        <View style={styles.tabs}>
          {[false, true].map((isSaved) => (
            <Pressable
              key={String(isSaved)}
              accessibilityRole="tab"
              accessibilityState={{ selected: savedOnly === isSaved }}
              onPress={() => setSavedOnly(isSaved)}
              style={[styles.tab, savedOnly === isSaved && styles.activeTab]}
            >
              <Text
                style={[
                  styles.tabText,
                  savedOnly === isSaved && styles.activeTabText,
                ]}
              >
                {isSaved ? `Saved offers · ${saved.length}` : "Discover offers"}
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.search}>
          <Icon name="search-outline" color={colors.muted} size={20} />
          <TextInput
            accessibilityLabel="Search shop offers"
            placeholder="Find your next little treat…"
            placeholderTextColor={colors.muted}
            value={query}
            onChangeText={setQuery}
            style={styles.input}
            returnKeyType="search"
          />
          {query !== "" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear offer search"
              onPress={() => setQuery("")}
              style={styles.iconButton}
            >
              <Icon name="close" size={20} />
            </Pressable>
          )}
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {categories.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: category === item }}
              onPress={() => setCategory(item)}
              style={({ pressed }) => [
                styles.chip,
                category === item && styles.activeChip,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  category === item && styles.activeChipText,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.sectionRow}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            {savedOnly ? "Your little stash" : "Treat yourself"}
          </Text>
          <Text style={styles.caption}>
            {visible.length} {visible.length === 1 ? "offer" : "offers"}
          </Text>
        </View>
        <Text style={styles.previewNote}>
          Preview collection · Partner offers are coming soon.
        </Text>
        {error !== "" && (
          <Text accessibilityRole="alert" style={styles.notice}>
            {error}
          </Text>
        )}
        <View style={styles.grid}>
          {visible.map((offer) => (
            <View key={offer.id} style={styles.card}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${offer.value}. ${offer.title}. View preview offer`}
                onPress={() => setSelected(offer)}
                style={({ pressed }) => pressed && styles.pressed}
              >
                <View
                  style={[styles.art, { backgroundColor: offer.background }]}
                >
                  <View style={styles.orbit} />
                  <View style={styles.artIcon}>
                    <Icon
                      name={offer.icon}
                      size={56}
                      color={questColors.navy}
                    />
                  </View>
                  <Text style={styles.value}>{offer.value}</Text>
                  <Text style={styles.previewBadge}>PREVIEW</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.eyebrow}>
                    {offer.category.toUpperCase()}
                  </Text>
                  <Text style={styles.cardTitle}>{offer.title}</Text>
                  <Text style={styles.cardCopy}>{offer.subtitle}</Text>
                </View>
              </Pressable>
              <View style={styles.cardFooter}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`View ${offer.title}`}
                  onPress={() => setSelected(offer)}
                  style={styles.detailsButton}
                >
                  <Text style={styles.detailsText}>View offer</Text>
                  <Icon name="arrow-forward" size={16} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${saved.includes(offer.id) ? "Unsave" : "Save"} ${offer.title}`}
                  accessibilityState={{
                    selected: saved.includes(offer.id),
                    disabled: !ready || saving,
                  }}
                  disabled={!ready || saving}
                  onPress={() => void toggleSave(offer)}
                  style={({ pressed }) => [
                    styles.iconButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={
                      saved.includes(offer.id) ? "bookmark" : "bookmark-outline"
                    }
                    size={21}
                  />
                </Pressable>
              </View>
            </View>
          ))}
        </View>
        {visible.length === 0 && (
          <View style={styles.empty}>
            <Icon
              name={savedOnly ? "bookmark-outline" : "search-outline"}
              size={36}
            />
            <Text style={styles.sectionTitle}>
              {savedOnly && !saved.length
                ? "Save a little something"
                : "No offers found"}
            </Text>
            <Text style={styles.emptyCopy}>
              {savedOnly && !saved.length
                ? "Tap the bookmark on any offer to keep it here for later."
                : "Try another search or explore all categories."}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setQuery("");
                setCategory("All offers");
                setSavedOnly(false);
              }}
              style={styles.reset}
            >
              <Text style={styles.detailsText}>Browse all offers</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.footnote}>
          <Icon name="heart-outline" size={18} color={colors.muted} />
          <Text style={styles.caption}>
            Little perks for a big appetite for discovery.
          </Text>
        </View>
      </ScrollView>
      <Modal
        visible={selected !== null}
        transparent
        animationType={reducedMotion === false ? "slide" : "none"}
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modal}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close offer details"
            onPress={() => setSelected(null)}
            style={styles.scrim}
          />
          {selected && (
            <View
              accessibilityViewIsModal
              style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}
            >
              <SheetDragHandle onDismiss={() => setSelected(null)} />
              <ScrollView contentContainerStyle={styles.sheetContent}>
                <View style={styles.sectionRow}>
                  <Text style={styles.eyebrow}>PREVIEW OFFER</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close offer details"
                    onPress={() => setSelected(null)}
                    style={styles.iconButton}
                  >
                    <Icon name="close" />
                  </Pressable>
                </View>
                <View
                  style={[
                    styles.detailArt,
                    { backgroundColor: selected.background },
                  ]}
                >
                  <Icon
                    name={selected.icon}
                    size={48}
                    color={questColors.navy}
                  />
                  <Text style={styles.detailValue}>{selected.value}</Text>
                </View>
                <Text accessibilityRole="header" style={styles.title}>
                  {selected.title}
                </Text>
                <Text style={styles.body}>{selected.subtitle}</Text>
                <Text style={styles.sectionTitle}>The little details</Text>
                <Text style={styles.body}>{selected.terms}</Text>
                <Text style={styles.notice}>
                  This is a sample offer. Partner locations, availability, and
                  redemption will be added when the shop launches.
                </Text>
                {error !== "" && (
                  <Text accessibilityRole="alert" style={styles.body}>
                    {error}
                  </Text>
                )}
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !ready || saving }}
                  disabled={!ready || saving}
                  onPress={() => void toggleSave(selected)}
                  style={({ pressed }) => [
                    styles.saveButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Icon
                    name={
                      saved.includes(selected.id)
                        ? "bookmark"
                        : "bookmark-outline"
                    }
                    color={colors.white}
                    size={20}
                  />
                  <Text style={styles.saveButtonText}>
                    {saving
                      ? "Saving…"
                      : saved.includes(selected.id)
                        ? "Remove from saved offers"
                        : "Save preview offer"}
                  </Text>
                </Pressable>
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 18,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    color: colors.muted,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: -0.8,
  },
  bag: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.tint,
    padding: 4,
    borderRadius: 16,
  },
  tab: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  activeTab: { backgroundColor: colors.accent },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: "600" },
  activeTabText: { color: colors.white },
  saveButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 4,
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    paddingVertical: 14,
    color: colors.ink,
    fontSize: 14,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  categories: { gap: 8 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
  },
  activeChip: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.ink, fontSize: 12, fontWeight: "600" },
  activeChipText: { color: colors.white },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: "700",
    flexShrink: 1,
  },
  caption: { color: colors.muted, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  previewNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    marginTop: -10,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  card: {
    flexGrow: 1,
    flexBasis: "45%",
    minWidth: 140,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  art: {
    minHeight: 190,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 26,
    paddingBottom: 18,
    gap: 10,
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    borderWidth: 1,
    borderColor: questColors.navy,
    opacity: 0.12,
    transform: [{ rotate: "-25deg" }, { scaleX: 1.4 }],
  },
  artIcon: { transform: [{ rotate: "-12deg" }] },
  value: {
    color: questColors.navy,
    fontSize: 25,
    fontWeight: "800",
    letterSpacing: -0.7,
  },
  previewBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    fontSize: 8,
    letterSpacing: 1,
    fontWeight: "700",
    color: questColors.navy,
  },
  cardBody: { padding: 14, gap: 7 },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "700",
  },
  cardCopy: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "auto",
    paddingLeft: 14,
    paddingRight: 4,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  detailsButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  detailsText: { fontSize: 12, fontWeight: "700", color: colors.ink },
  footnote: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
  },
  pressed: { opacity: 0.65 },
  empty: { paddingVertical: 32, gap: 16, alignItems: "center" },
  emptyCopy: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
  },
  reset: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 24,
    backgroundColor: colors.tint,
  },
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
    paddingHorizontal: 24,
    paddingTop: 12,
    width: "100%",
    maxWidth: 640,
    maxHeight: "90%",
    alignSelf: "center",
  },
  sheetContent: { gap: 18 },
  detailArt: {
    borderRadius: 20,
    padding: 24,
    flexDirection: "row",
    gap: 24,
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
  },
  detailValue: { fontSize: 32, fontWeight: "800", color: questColors.navy },
  body: { fontSize: 14, lineHeight: 22, color: colors.muted },
  notice: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.tint,
    color: colors.ink,
    fontSize: 13,
    lineHeight: 21,
  },
  saveButton: {
    flexDirection: "row",
    gap: 10,
    minHeight: 52,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.accent,
  },
});
