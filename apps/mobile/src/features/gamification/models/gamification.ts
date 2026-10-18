export type BadgeId =
  | "first-bite"
  | "cuisine-explorer"
  | "world-taster"
  | "collector"
  | "foodie"
  | "gourmet"
  | "rater"
  | "critic"
  | "saver"
  | "wanderer"
  | "streak-3"
  | "streak-7"
  | "passport-pro"
  | "menu-maestro"
  | "century-supper"
  | "curator"
  | "pin-collector"
  | "peoples-palate"
  | "two-week-taster"
  | "xp-legend";

export type Badge = {
  id: BadgeId;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: string;
};

export const BADGES: Badge[] = [
  { id: "first-bite", name: "First Bite", description: "Discover your first dish.", icon: "restaurant" },
  { id: "cuisine-explorer", name: "Cuisine Explorer", description: "Explore 5 different cuisines.", icon: "compass" },
  { id: "world-taster", name: "World Taster", description: "Explore every cuisine.", icon: "globe" },
  { id: "collector", name: "Collector", description: "Collect 10 dishes.", icon: "albums" },
  { id: "foodie", name: "Foodie", description: "Collect 25 dishes.", icon: "star" },
  { id: "gourmet", name: "Gourmet", description: "Collect 50 dishes.", icon: "trophy" },
  { id: "rater", name: "Rater", description: "Rate 5 restaurants.", icon: "thumbs-up" },
  { id: "critic", name: "Critic", description: "Rate 25 restaurants.", icon: "create" },
  { id: "saver", name: "Saver", description: "Save 5 restaurants.", icon: "bookmark" },
  { id: "wanderer", name: "Wanderer", description: "Save 25 restaurants.", icon: "map" },
  { id: "streak-3", name: "On a Roll", description: "3-day discovery streak.", icon: "flame" },
  { id: "streak-7", name: "Week Warrior", description: "7-day discovery streak.", icon: "flash" },
  { id: "passport-pro", name: "Passport Pro", description: "Explore 8 different cuisines.", icon: "map" },
  { id: "menu-maestro", name: "Menu Maestro", description: "Log 75 dishes.", icon: "restaurant" },
  { id: "century-supper", name: "Century Supper Club", description: "Log 100 dishes.", icon: "trophy" },
  { id: "curator", name: "Curator", description: "Save 10 restaurants.", icon: "bookmark" },
  { id: "pin-collector", name: "Pin Collector", description: "Save 50 restaurants.", icon: "pin" },
  { id: "peoples-palate", name: "People's Palate", description: "Rate 50 restaurants.", icon: "star" },
  { id: "two-week-taster", name: "Two-Week Taster", description: "Keep a 14-day discovery streak.", icon: "flame" },
  { id: "xp-legend", name: "XP Legend", description: "Earn 2,000 experience points.", icon: "sparkles" },
];

export type GamificationState = {
  xp: number;
  level: number;
  streak: number;
  lastActiveDate: string;
  badges: BadgeId[];
  discoveries: number;
  saves: number;
  ratings: number;
  cuisinesExplored: number;
  xpEvents: number;
};

export const XP_PER_DISCOVERY = 50;
export const XP_PER_SAVE = 10;
export const XP_PER_RATING = 15;
export const XP_PER_LEVEL = 200;

export function createInitialState(): GamificationState {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: "",
    badges: [],
    discoveries: 0,
    saves: 0,
    ratings: 0,
    cuisinesExplored: 0,
    xpEvents: 0,
  };
}

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor(xp / XP_PER_LEVEL) + 1);
}

export function xpToNextLevel(xp: number): { current: number; needed: number } {
  const level = levelForXp(xp);
  const base = (level - 1) * XP_PER_LEVEL;
  return { current: xp - base, needed: XP_PER_LEVEL };
}

export function updateStreak(
  state: GamificationState,
  now: Date = new Date(),
): GamificationState {
  const today = now.toISOString().slice(0, 10);
  if (state.lastActiveDate === today) return state;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().slice(0, 10);
  const streak =
    state.lastActiveDate === yStr ? state.streak + 1 : 1;
  return { ...state, streak, lastActiveDate: today };
}

export function applyDiscovery(
  state: GamificationState,
  cuisineCount: number,
  now: Date = new Date(),
): { state: GamificationState; unlocked: BadgeId[] } {
  let next = updateStreak(state, now);
  next = {
    ...next,
    xp: next.xp + XP_PER_DISCOVERY,
    discoveries: next.discoveries + 1,
    cuisinesExplored: Math.max(next.cuisinesExplored, cuisineCount),
    xpEvents: next.xpEvents + 1,
  };
  next.level = levelForXp(next.xp);
  const unlocked = evaluateBadges(next);
  next = { ...next, badges: Array.from(new Set([...next.badges, ...unlocked])) };
  return { state: next, unlocked };
}

export function applySave(state: GamificationState): {
  state: GamificationState;
  unlocked: BadgeId[];
} {
  const next = {
    ...state,
    xp: state.xp + XP_PER_SAVE,
    saves: state.saves + 1,
    xpEvents: state.xpEvents + 1,
  };
  next.level = levelForXp(next.xp);
  const unlocked = evaluateBadges(next);
  next.badges = Array.from(new Set([...next.badges, ...unlocked]));
  return { state: next, unlocked };
}

export function applyRating(state: GamificationState): {
  state: GamificationState;
  unlocked: BadgeId[];
} {
  const next = {
    ...state,
    xp: state.xp + XP_PER_RATING,
    ratings: state.ratings + 1,
    xpEvents: state.xpEvents + 1,
  };
  next.level = levelForXp(next.xp);
  const unlocked = evaluateBadges(next);
  next.badges = Array.from(new Set([...next.badges, ...unlocked]));
  return { state: next, unlocked };
}

export function evaluateBadges(state: GamificationState): BadgeId[] {
  const unlocked: BadgeId[] = [];
  const has = (id: BadgeId) => state.badges.includes(id);
  if (state.discoveries >= 1 && !has("first-bite")) unlocked.push("first-bite");
  if (state.cuisinesExplored >= 5 && !has("cuisine-explorer"))
    unlocked.push("cuisine-explorer");
  if (state.cuisinesExplored >= 14 && !has("world-taster"))
    unlocked.push("world-taster");
  if (state.discoveries >= 10 && !has("collector")) unlocked.push("collector");
  if (state.discoveries >= 25 && !has("foodie")) unlocked.push("foodie");
  if (state.discoveries >= 50 && !has("gourmet")) unlocked.push("gourmet");
  if (state.ratings >= 5 && !has("rater")) unlocked.push("rater");
  if (state.ratings >= 25 && !has("critic")) unlocked.push("critic");
  if (state.saves >= 5 && !has("saver")) unlocked.push("saver");
  if (state.saves >= 25 && !has("wanderer")) unlocked.push("wanderer");
  if (state.streak >= 3 && !has("streak-3")) unlocked.push("streak-3");
  if (state.streak >= 7 && !has("streak-7")) unlocked.push("streak-7");
  if (state.cuisinesExplored >= 8 && !has("passport-pro")) unlocked.push("passport-pro");
  if (state.discoveries >= 75 && !has("menu-maestro")) unlocked.push("menu-maestro");
  if (state.discoveries >= 100 && !has("century-supper")) unlocked.push("century-supper");
  if (state.saves >= 10 && !has("curator")) unlocked.push("curator");
  if (state.saves >= 50 && !has("pin-collector")) unlocked.push("pin-collector");
  if (state.ratings >= 50 && !has("peoples-palate")) unlocked.push("peoples-palate");
  if (state.streak >= 14 && !has("two-week-taster")) unlocked.push("two-week-taster");
  if (state.xp >= 2000 && !has("xp-legend")) unlocked.push("xp-legend");
  return unlocked;
}

export function parseGamification(raw: unknown): GamificationState {
  const initial = createInitialState();
  if (!raw || typeof raw !== "object") return initial;
  const r = raw as Record<string, unknown>;
  const badges = Array.isArray(r.badges)
    ? r.badges.filter((b): b is BadgeId =>
        BADGES.some((badge) => badge.id === b),
      )
    : [];
  return {
    xp: typeof r.xp === "number" ? r.xp : initial.xp,
    level: typeof r.level === "number" ? r.level : initial.level,
    streak: typeof r.streak === "number" ? r.streak : initial.streak,
    lastActiveDate:
      typeof r.lastActiveDate === "string" ? r.lastActiveDate : initial.lastActiveDate,
    badges,
    discoveries: typeof r.discoveries === "number" ? r.discoveries : initial.discoveries,
    saves: typeof r.saves === "number" ? r.saves : initial.saves,
    ratings: typeof r.ratings === "number" ? r.ratings : initial.ratings,
    cuisinesExplored:
      typeof r.cuisinesExplored === "number"
        ? r.cuisinesExplored
        : initial.cuisinesExplored,
    xpEvents: typeof r.xpEvents === "number" ? r.xpEvents : initial.xpEvents,
  };
}
