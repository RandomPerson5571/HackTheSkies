import { useMenuSound } from "../../../hooks/useMenuSound";
import { FeedbackPressable as Pressable } from "../../../components/FeedbackPressable";
import { SheetDragHandle } from "../../../components/SheetDragHandle";
import { useState } from "react";
import { CiboLogo } from "../../../components/CiboLogo";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ProfileAtlas } from "../components/ProfileAtlas";

import { colors } from "../../../theme/index";
import { playFeedback } from "../../../lib/sensory";
import type { Profile } from "../models/profile";
export type { Profile } from "../models/profile";

import { useFoodDex } from "../../food-dex/hooks/useFoodDex";
import { findCatalogDish } from "../../food-dex/models/foodDex";
import { CatalogPhoto } from "../../food-dex/components/CatalogPhoto";
import { catalogPhoto } from "../../food-dex/services/catalogPhotos";
import { DecoratedAvatar, TrophyArt } from "../components/RewardArt";
import { ProfileWardrobe } from "../components/ProfileWardrobe";
import {
  resolveCustomization,
  type Customization,
} from "../models/customization";
import { useQuests } from "../../quests/hooks/useQuests";
import {
  BADGES,
  evaluateBadges,
  xpToNextLevel,
  type BadgeId,
  type GamificationState,
} from "../../gamification/models/gamification";

const badgeProgress = (
  badge: { id: BadgeId },
  entriesCount: number,
  cuisinesCount: number,
  savedCount: number,
  streak: number,
  ratings: number,
  xp: number,
): { current: number; target: number } => {
  switch (badge.id) {
    case "first-bite":
      return { current: entriesCount, target: 1 };
    case "cuisine-explorer":
      return { current: cuisinesCount, target: 5 };
    case "world-taster":
      return { current: cuisinesCount, target: 14 };
    case "collector":
      return { current: entriesCount, target: 10 };
    case "foodie":
      return { current: entriesCount, target: 25 };
    case "gourmet":
      return { current: entriesCount, target: 50 };
    case "rater":
      return { current: ratings, target: 5 };
    case "critic":
      return { current: ratings, target: 25 };
    case "saver":
      return { current: savedCount, target: 5 };
    case "wanderer":
      return { current: savedCount, target: 25 };
    case "streak-3":
      return { current: streak, target: 3 };
    case "streak-7":
      return { current: streak, target: 7 };
    case "passport-pro":
      return { current: cuisinesCount, target: 8 };
    case "menu-maestro":
      return { current: entriesCount, target: 75 };
    case "century-supper":
      return { current: entriesCount, target: 100 };
    case "curator":
      return { current: savedCount, target: 10 };
    case "pin-collector":
      return { current: savedCount, target: 50 };
    case "peoples-palate":
      return { current: ratings, target: 50 };
    case "two-week-taster":
      return { current: streak, target: 14 };
    case "xp-legend":
      return { current: xp, target: 2000 };
    default:
      return { current: 0, target: 1 };
  }
};

export function ProfileScreen({
  profile,
  onSave,
  onUploadAvatar,
  game,
  ratingsCount = 0,
  topInset,
  bottomInset,
  storageError,
  saved = [],
  onOpenSettings,
  onOpenDex,
}: {
  saved?: string[];
  profile: Profile;
  onSave: (profile: Profile) => void;
  onUploadAvatar?: () => void;
  game: GamificationState;
  ratingsCount?: number;
  topInset: number;
  bottomInset: number;
  storageError: string;
  onOpenSettings?: () => void;
  onOpenDex?: () => void;
}) {
  const { entries } = useFoodDex();
  const { state: quests, error: questError } = useQuests();
  const [customizing, setCustomizing] = useState(false);
  const [avatarPickerVisible, setAvatarPickerVisible] = useState(false);
  const [showAllBadges, setShowAllBadges] = useState(false);
  useMenuSound(customizing);
  useMenuSound(avatarPickerVisible);
  useMenuSound(showAllBadges);


  const foodsCount = entries.length;
  const cuisinesCount = new Set(entries.map((entry) => entry.cuisine)).size;
  const streak = game.streak;
  const questXp = quests.bonusXp;
  const totalXp = Math.max(0, game.xp) + questXp;
  const xp = xpToNextLevel(totalXp);
  const xpPercent = Math.round((xp.current / xp.needed) * 100);

  const earnedBadgeIds = new Set<BadgeId>([
    ...game.badges,
    ...evaluateBadges(game),
  ]);
  if (foodsCount >= 1) earnedBadgeIds.add("first-bite");
  if (cuisinesCount >= 5) earnedBadgeIds.add("cuisine-explorer");
  if (cuisinesCount >= 14) earnedBadgeIds.add("world-taster");
  if (foodsCount >= 10) earnedBadgeIds.add("collector");
  if (foodsCount >= 25) earnedBadgeIds.add("foodie");
  if (foodsCount >= 50) earnedBadgeIds.add("gourmet");
  if (saved.length >= 5) earnedBadgeIds.add("saver");
  if (saved.length >= 25) earnedBadgeIds.add("wanderer");
  if (streak >= 3) earnedBadgeIds.add("streak-3");
  if (streak >= 7) earnedBadgeIds.add("streak-7");
  if (ratingsCount >= 5) earnedBadgeIds.add("rater");
  if (ratingsCount >= 25) earnedBadgeIds.add("critic");

  const appearance = resolveCustomization(
    profile.customization,
    totalXp,
    earnedBadgeIds,
  );
  const { level, rank, nextRank } = appearance;
  const featuredBadge = BADGES.find(
    (badge) => badge.id === appearance.featuredBadge,
  );
  const changeCustomization = (change: Partial<Customization>) => {
    onSave({
      ...profile,
      customization: { ...appearance.selected, ...change },
    });
    void playFeedback("tap");
  };

  const featuredBadges = [
    ...BADGES.filter((badge) => earnedBadgeIds.has(badge.id as BadgeId)),
    ...BADGES.filter((badge) => !earnedBadgeIds.has(badge.id as BadgeId)),
  ].slice(0, showAllBadges ? BADGES.length : 4);

  const renderBadge = (badge: (typeof BADGES)[number]) => {
    const earned = earnedBadgeIds.has(badge.id);
    const progress = badgeProgress(
      badge,
      foodsCount,
      cuisinesCount,
      saved.length,
      streak,
      Math.max(ratingsCount, game.ratings),
      game.xp,
    );
    const pinned = featuredBadge?.id === badge.id;
    return (
      <Pressable
        key={badge.id}
        accessibilityRole="button"
        disabled={!earned}
        accessibilityLabel={`${badge.name}. ${badge.description} ${earned ? (pinned ? "Featured trophy" : "Earned. Tap to feature on your profile") : `Locked. ${Math.min(progress.current, progress.target)} of ${progress.target}`}`}
        aria-pressed={pinned}
        accessibilityState={{ disabled: !earned, selected: pinned }}
        onPress={() => changeCustomization({ featuredBadge: badge.id })}
        style={({ pressed }) => [
          styles.badge,
          showAllBadges && styles.badgeGridItem,
          !earned && styles.badgeLocked,
          pinned && styles.badgePinned,
          pressed && styles.pressed,
        ]}
      >
        <TrophyArt id={badge.id} size={88} locked={!earned} />
        <Text style={styles.badgeName}>{badge.name}</Text>
        <Text style={styles.badgeDescription}>{badge.description}</Text>
        <Text style={earned ? styles.badgeEarned : styles.badgeProgress}>
          {earned
            ? pinned
              ? "Featured"
              : "Earned Â· Tap to feature"
            : `Locked Â· ${Math.min(progress.current, progress.target)}/${progress.target}`}
        </Text>
      </Pressable>
    );
  };

  const recent = entries.slice(0, 8);

  const handleOpenSettings = () => {
    void playFeedback("tap");
    onOpenSettings?.();
  };
  const handleOpenDex = () => {
    void playFeedback("tap");
    onOpenDex?.();
  };

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topInset + 16, paddingBottom: bottomInset + 112 },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.profileHeader}>
        <View style={styles.headerTopRow}>
          <CiboLogo />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={handleOpenSettings}
            style={({ pressed }) => [
              styles.gearButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="settings-outline" color={colors.ink} size={20} />
          </Pressable>
        </View>

        <View>
          <Text style={styles.eyebrow}>MY PROFILE</Text>
          <Text style={styles.profileTitle}>Your Profile</Text>
        </View>
        <View style={styles.identityRow}>
          <View style={styles.avatarFrame}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                profile.avatarUri
                  ? "Change profile picture"
                  : "Upload profile picture"
              }
              onPress={() => setAvatarPickerVisible(true)}
              style={({ pressed }) => pressed && styles.avatarPressed}
            >
              <DecoratedAvatar
                name={profile.name}
                frame={appearance.frame}
                palette={appearance.palette}
                imageUri={profile.avatarUri}
              />
            </Pressable>
            <View pointerEvents="none" style={styles.avatarCamera}>
              <Ionicons name="camera" color={colors.white} size={13} />
            </View>
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>Lv {level}</Text>
            </View>
          </View>
          <View style={styles.identityText}>
            <Text style={styles.name}>{profile.name}</Text>
            <Text style={styles.handle}>
              @
              {profile.name.replace(/\s+/g, "").toLowerCase() || "foodexplorer"}
            </Text>
            <Text style={styles.titleLine}>
              Level {level} · {rank.name}
            </Text>
          </View>
        </View>
        {featuredBadge && (
          <View style={styles.featuredTrophy}>
            <TrophyArt id={featuredBadge.id} size={48} />
            <View style={styles.flex}>
              <Text style={styles.eyebrow}>FEATURED TROPHY</Text>
              <Text style={styles.featuredName}>{featuredBadge.name}</Text>
            </View>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={colors.ink}
              accessible={false}
            />
          </View>
        )}

        <View style={styles.xpBlock}>
          <View style={styles.xpRow}>
            <Text style={styles.xpText}>
              {xp.current.toLocaleString()} / {xp.needed.toLocaleString()} XP
            </Text>
            <Text style={styles.xpPercent}>{xpPercent}%</Text>
          </View>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel="XP to next level"
            aria-valuemin={0}
            aria-valuemax={xp.needed}
            aria-valuenow={xp.current}
            accessibilityValue={{ min: 0, max: xp.needed, now: xp.current }}
            style={styles.xpTrack}
          >
            <View style={[styles.xpFill, { width: `${xpPercent}%` }]} />
          </View>
          <Text style={styles.copy}>
            {totalXp.toLocaleString()} total XP ·{" "}
            {nextRank
              ? `${((nextRank.level - 1) * 200 - totalXp).toLocaleString()} XP to ${nextRank.name}`
              : "Highest rank unlocked"}
          </Text>
        </View>

        <View style={styles.statsRow}>
          {[
            { value: foodsCount, label: "Foods" },
            { value: cuisinesCount, label: "Cuisines" },
            { value: streak, label: "Streak" },
          ].map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Customize your profile"
        aria-expanded={customizing}
        accessibilityState={{ expanded: customizing }}
        onPress={() => {
          setCustomizing(!customizing);
        }}
        style={({ pressed }) => [
          styles.customizeButton,
          pressed && styles.pressed,
        ]}
      >
        <Ionicons
          name="color-palette-outline"
          color={colors.ink}
          size={20}
          accessible={false}
        />
        <Text style={styles.customizeText}>
          {customizing ? "Close customization" : "Customize profile"}
        </Text>
        <Ionicons
          name={customizing ? "chevron-up" : "chevron-down"}
          color={colors.ink}
          size={18}
          accessible={false}
        />
      </Pressable>
      {customizing && (
        <ProfileWardrobe
          name={profile.name}
          selected={appearance.selected}
          level={level}
          earned={earnedBadgeIds}
          onChange={changeCustomization}
        />
      )}
      {questError ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          {questError}
        </Text>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Trophy Cabinet
          </Text>
          <Pressable
            accessibilityRole="button"
            aria-expanded={showAllBadges}
            accessibilityState={{ expanded: showAllBadges }}
            onPress={() => setShowAllBadges(!showAllBadges)}
            style={styles.sectionAction}
          >
            <Text style={styles.link}>
              {showAllBadges ? "Show less" : "View all"}
            </Text>
          </Pressable>
        </View>
        <Text style={styles.copy}>
          {earnedBadgeIds.size} of {BADGES.length} trophies earned · A reward
          for every kind of appetite.
        </Text>
        {showAllBadges ? (
          <View style={styles.badgeGrid}>
            {featuredBadges.map(renderBadge)}
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.badgeRow}
          >
            {featuredBadges.map(renderBadge)}
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Recent Discoveries
          </Text>
          <Pressable onPress={handleOpenDex}>
            <Text style={styles.link}>See all →</Text>
          </Pressable>
        </View>
        {recent.length === 0 ? (
          <View style={styles.emptyDiscoveries}>
            <Ionicons name="camera-outline" color={colors.muted} size={28} />
            <Text style={styles.hint}>
              Discover your first dish to fill this gallery.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.recentRow}
          >
            {recent.map((entry) => {
              const dish = findCatalogDish(entry.name, entry.cuisine);
              return (
                <View key={entry.id} style={styles.recentCard}>
                  <CatalogPhoto
                    source={
                      entry.photo ? { uri: entry.photo } : catalogPhoto(dish)
                    }
                    label={entry.name}
                    style={styles.recentPhoto}
                  />
                  <Text style={styles.recentName} numberOfLines={1}>
                    {entry.name}
                  </Text>
                  <Text style={styles.recentCuisine} numberOfLines={1}>
                    {entry.cuisine}
                  </Text>
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>

      <ProfileAtlas
        entries={entries}
        onOpenDex={onOpenDex}
      />

      {storageError ? (
        <Text accessibilityRole="alert" style={styles.hint}>
          {storageError}
        </Text>
      ) : null}
    </ScrollView>
    <Modal
      visible={avatarPickerVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setAvatarPickerVisible(false)}
    >
      <View style={styles.avatarModalOverlay}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close profile photo options"
          onPress={() => setAvatarPickerVisible(false)}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.avatarModal}>
          <SheetDragHandle onDismiss={() => setAvatarPickerVisible(false)} />
          <View style={styles.avatarModalHeader}>
            <View style={styles.flex}>
              <Text style={styles.sectionTitle}>Profile picture</Text>
              <Text style={styles.hint}>
                Choose a photo for your profile and map marker.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close profile photo options"
              onPress={() => setAvatarPickerVisible(false)}
              style={styles.avatarModalClose}
            >
              <Ionicons name="close" color={colors.ink} size={20} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setAvatarPickerVisible(false);
              onUploadAvatar?.();
            }}
            style={({ pressed }) => [
              styles.avatarModalAction,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="images-outline" color={colors.accent} size={20} />
            <Text style={styles.avatarModalActionText}>
              {profile.avatarUri ? "Choose a new photo" : "Upload a photo"}
            </Text>
          </Pressable>
          {profile.avatarUri ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                onSave({ ...profile, avatarUri: undefined });
                setAvatarPickerVisible(false);
              }}
              style={({ pressed }) => [
                styles.avatarModalAction,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="trash-outline" color={colors.coral} size={20} />
              <Text
                style={[styles.avatarModalActionText, { color: colors.coral }]}
              >
                Remove photo
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={() => setAvatarPickerVisible(false)}
            style={styles.avatarModalCancel}
          >
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: {
    paddingHorizontal: 20,
    gap: 18,
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
  },
  flex: { flex: 1, gap: 4 },
  profileHeader: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
    boxShadow: "0 6px 24px #3D568F12",
  },
  headerTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
  },
  profileTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  gearButton: {
    width: 48,
    height: 48,
    borderRadius: 20,
    backgroundColor: colors.tint,
    alignItems: "center",
    justifyContent: "center",
  },
  identityRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  avatarFrame: { position: "relative" },
  avatarPressed: { opacity: 0.75 },
  avatarCamera: {
    position: "absolute",
    left: 2,
    bottom: 2,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: colors.paper,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarModalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "rgba(15,27,49,0.48)",
  },
  avatarModal: {
    width: "100%",
    maxWidth: 420,
    padding: 20,
    gap: 10,
    borderRadius: 24,
    backgroundColor: colors.paper,
  },
  avatarModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  avatarModalClose: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: colors.tint,
  },
  avatarModalAction: {
    minHeight: 54,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: colors.tint,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarModalActionText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "600",
  },
  avatarModalCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  levelPill: {
    position: "absolute",
    bottom: -1,
    right: 0,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelPillText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  identityText: { flex: 1, gap: 2 },
  name: { color: colors.ink, fontSize: 22, fontWeight: "700" },
  handle: { color: colors.muted, fontSize: 12, fontWeight: "600" },
  titleLine: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  xpBlock: { gap: 8 },
  xpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  xpText: { color: colors.ink, fontSize: 13, fontWeight: "600" },
  xpPercent: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  xpTrack: {
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.tint,
    overflow: "hidden",
  },
  xpFill: { height: "100%", borderRadius: 5, backgroundColor: colors.accent },
  statsRow: {
    flexDirection: "row",
    backgroundColor: colors.tint,
    borderRadius: 18,
    paddingVertical: 12,
  },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { color: colors.accent, fontSize: 22, fontWeight: "700" },
  statLabel: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  section: { gap: 10 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionTitle: { color: colors.ink, fontSize: 17, fontWeight: "700", flex: 1 },
  link: { color: colors.accent, fontSize: 12, fontWeight: "700" },
  copy: { color: colors.muted, fontSize: 12, lineHeight: 19 },
  hint: { color: colors.accent, fontSize: 12, lineHeight: 19 },
  badgeRow: { gap: 12, paddingVertical: 2 },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  badgeGridItem: { width: "47%" },
  badge: {
    width: 160,
    borderRadius: 20,
    padding: 12,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    gap: 6,
  },
  badgeLocked: { backgroundColor: colors.paper },
  badgePinned: { borderColor: colors.ink, backgroundColor: colors.tint },
  badgeDescription: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    minHeight: 32,
  },
  badgeName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  badgeProgress: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  badgeEarned: { color: colors.accent, fontSize: 11, fontWeight: "700" },
  emptyDiscoveries: {
    borderRadius: 20,
    padding: 24,
    backgroundColor: colors.tint,
    alignItems: "center",
    gap: 8,
  },
  recentRow: { gap: 12, paddingVertical: 2 },
  recentCard: {
    width: 132,
    borderRadius: 18,
    padding: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  recentPhoto: { width: "100%", height: 110, borderRadius: 14 },
  recentName: { color: colors.ink, fontSize: 12, fontWeight: "700" },
  recentCuisine: { color: colors.muted, fontSize: 10, fontWeight: "600" },
  featuredTrophy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: colors.tint,
  },
  featuredName: { color: colors.ink, fontSize: 13, fontWeight: "700" },
  customizeButton: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    gap: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.tint,
  },
  customizeText: {
    flex: 1,
    color: colors.ink,
    fontSize: 13,
    fontWeight: "700",
  },
  sectionAction: {
    minHeight: 48,
    minWidth: 64,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  pressed: { opacity: 0.65 },
});
