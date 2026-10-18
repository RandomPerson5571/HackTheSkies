import {
  BADGES,
  levelForXp,
  type BadgeId,
} from "../../gamification/models/gamification.ts";

export const ranks = [
  { id: "sprout", name: "Fresh Sprout", level: 1 },
  { id: "sous-chef", name: "Sous Chef", level: 5 },
  { id: "artisan", name: "Flavor Artisan", level: 10 },
  { id: "connoisseur", name: "Connoisseur", level: 15 },
  { id: "master", name: "Master Chef", level: 20 },
] as const;
export type RankId = (typeof ranks)[number]["id"];

export const banners = [
  { id: "garden", name: "Kitchen Garden", level: 1 },
  { id: "midnight", name: "Midnight Diner", level: 5 },
  { id: "market", name: "Sunday Market", level: 10 },
] as const;
export type BannerId = (typeof banners)[number]["id"];

export const avatarPalettes = [
  {
    id: "matcha",
    name: "Matcha",
    background: "#EAF3B2",
    foreground: "#253D6A",
  },
  { id: "peach", name: "Peach", background: "#FADED4", foreground: "#713D36" },
  { id: "ube", name: "Ube", background: "#E8DEF5", foreground: "#534075" },
] as const;
export type AvatarPaletteId = (typeof avatarPalettes)[number]["id"];

export type Customization = {
  frame: "auto" | "none" | RankId;
  banner: BannerId;
  palette: AvatarPaletteId;
  featuredBadge: "auto" | "none" | BadgeId;
};

export function parseCustomization(raw: unknown): Customization {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    frame:
      value.frame === "none" || ranks.some((rank) => rank.id === value.frame)
        ? (value.frame as Customization["frame"])
        : "auto",
    banner: banners.some((banner) => banner.id === value.banner)
      ? (value.banner as BannerId)
      : "garden",
    palette: avatarPalettes.some((palette) => palette.id === value.palette)
      ? (value.palette as AvatarPaletteId)
      : "matcha",
    featuredBadge:
      value.featuredBadge === "none" ||
      BADGES.some((badge) => badge.id === value.featuredBadge)
        ? (value.featuredBadge as Customization["featuredBadge"])
        : "auto",
  };
}

// XP is the source of truth; a cached level cannot unlock a higher tier.
export function rankForXp(xp: number) {
  const level = levelForXp(Number.isFinite(xp) ? Math.max(0, xp) : 0);
  return [...ranks].reverse().find((rank) => level >= rank.level)!;
}

export function resolveCustomization(
  raw: unknown,
  xp: number,
  earned: ReadonlySet<BadgeId>,
) {
  const selected = parseCustomization(raw);
  const rank = rankForXp(xp);
  const level = levelForXp(Number.isFinite(xp) ? Math.max(0, xp) : 0);
  const requestedFrame = ranks.find((item) => item.id === selected.frame);
  const frame =
    selected.frame === "none"
      ? null
      : requestedFrame && requestedFrame.level <= level
        ? requestedFrame.id
        : rank.id;
  const banner =
    banners.find((item) => item.id === selected.banner && item.level <= level)
      ?.id ?? "garden";
  const featuredBadge =
    selected.featuredBadge === "none"
      ? null
      : selected.featuredBadge !== "auto" && earned.has(selected.featuredBadge)
        ? selected.featuredBadge
        : (BADGES.find((badge) => earned.has(badge.id))?.id ?? null);
  return {
    selected: {
      ...selected,
      frame:
        requestedFrame && requestedFrame.level > level
          ? ("auto" as const)
          : selected.frame,
      banner,
      featuredBadge:
        selected.featuredBadge !== "auto" &&
        selected.featuredBadge !== "none" &&
        !earned.has(selected.featuredBadge)
          ? ("auto" as const)
          : selected.featuredBadge,
    },
    rank,
    level,
    frame,
    banner,
    featuredBadge,
    palette: avatarPalettes.find((item) => item.id === selected.palette)!,
    nextRank: ranks.find((item) => item.level > level),
  };
}
