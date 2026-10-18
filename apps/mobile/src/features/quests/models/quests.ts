import { catalogDishes } from "../../../../../../packages/food-catalog/data/catalog.ts";
import { challenges } from "../data/challenges.ts";
import type { FoodEntry } from "../../food-dex/models/foodDex.ts";
import { places } from "../../restaurants/data/places.ts";

export const pathCuisines = [
  "Japanese",
  "Italian",
  "Korean",
  "Chinese",
  "French",
  "Vietnamese",
  "South Asian",
] as const;
export type PathCuisine = (typeof pathCuisines)[number];
export type QuestType =
  | "knowledge"
  | "discovery"
  | "cultural"
  | "exploration"
  | "mystery"
  | "bonus"
  | "boss";
export const chapters = [
  {
    name: "First Bites",
    subtitle: "A little curiosity goes a long way.",
    rank: "Beginner",
  },
  {
    name: "Signature Dishes",
    subtitle: "Get to know the crowd favourites.",
    rank: "Explorer",
  },
  {
    name: "Hidden Gems",
    subtitle: "Look closer. Find something unexpected.",
    rank: "Adventurer",
  },
  {
    name: "Cuisine Mastery",
    subtitle: "Bring everything you've learned to the table.",
    rank: "Master",
  },
] as const;

// Every lesson and AI choice resolves to the existing Food Dex catalog.
export const pathDishIds: Record<PathCuisine, string[]> = {
  Japanese: ["ramen", "sushi", "tempura", "okonomiyaki"],
  Italian: ["pizza", "carbonara", "risotto", "tiramisu"],
  Korean: ["bibimbap", "bulgogi", "kimchi-jjigae", "naengmyeon"],
  Chinese: ["dumplings", "mapo-tofu", "peking-duck", "chow-mein"],
  French: ["ratatouille", "coq-au-vin", "croissant", "crepe"],
  Vietnamese: ["pho", "banh-mi", "goi-cuon", "bun-cha"],
  "South Asian": ["biryani", "dosa", "chana-masala", "samosa"],
};
export function pathDishes(cuisine: PathCuisine) {
  return pathDishIds[cuisine].map((id) =>
    catalogDishes.find((dish) => dish.id === id)!,
  );
}
export type Quest = {
  id: string;
  cuisine: PathCuisine;
  chapter: number;
  type: QuestType;
  title: string;
  xp: number;
  dishId: string;
};
export function questsFor(cuisine: PathCuisine): Quest[] {
  return pathDishes(cuisine).flatMap((dish, chapter) => {
    const types: QuestType[] = [
      chapter === 2 ? "mystery" : "knowledge",
      "discovery",
      chapter === 1 ? "bonus" : "cultural",
      "exploration",
      "boss",
    ];
    const titles = [
      chapter === 2 ? "The mystery on your plate" : `Meet ${dish.name}`,
      `Discover ${dish.name}`,
      chapter === 1
        ? "A little reward for your curiosity"
        : `Inside the dish: ${dish.name}`,
      `Your ${cuisine} food adventure`,
      `${chapters[chapter]!.name} finale`,
    ];
    return types.map((type, step) => ({
      id: `${cuisine.toLowerCase()}-${chapter}-${step}`,
      cuisine,
      chapter,
      type,
      title: titles[step]!,
      xp: [25, 50, 35, 50, 100][step]!,
      dishId: dish.id,
    }));
  });
}
export const allQuests = pathCuisines.flatMap(questsFor);
export type BonusRun = {
  startedAt: string;
  visits: {
    id: string;
    cuisine: string;
    neighborhood: string;
    category: string;
  }[];
  claimed: boolean;
};
export type PersonalizedQuest = {
  dishId: string;
  reason: string;
  restaurantId: string | null;
  template: "learn" | "discover";
};
export type QuestState = {
  selectedCuisine: PathCuisine;
  completed: string[];
  bonus: Record<string, BonusRun>;
  bonusXp: number;
  personalized: Partial<Record<PathCuisine, PersonalizedQuest>>;
};
export function initialQuests(): QuestState {
  return {
    selectedCuisine: "Japanese",
    completed: [],
    bonus: {},
    bonusXp: 0,
    personalized: {},
  };
}
export function isPathCuisine(value: unknown): value is PathCuisine {
  return pathCuisines.includes(value as PathCuisine);
}
export function personalizedId(cuisine: PathCuisine) {
  return `personalized-${cuisine}`;
}
export function parseQuests(value: unknown): QuestState {
  const initial = initialQuests();
  if (!value || typeof value !== "object") return initial;
  const raw = value as Partial<QuestState>;
  const valid = new Set([
    ...allQuests.map((quest) => quest.id),
    ...pathCuisines.map(personalizedId),
  ]);
  const completed = Array.isArray(raw.completed)
    ? [...new Set(raw.completed.filter((id) => valid.has(id)))]
    : [];
  // A corrupt or old snapshot cannot skip prerequisite nodes.
  initial.completed = pathCuisines.flatMap((cuisine) => {
    const path = questsFor(cuisine);
    const firstMissing = path.findIndex(
      (quest) => !completed.includes(quest.id),
    );
    return path
      .slice(0, firstMissing < 0 ? path.length : firstMissing)
      .map((quest) => quest.id);
  });
  initial.selectedCuisine = isPathCuisine(raw.selectedCuisine)
    ? raw.selectedCuisine
    : "Japanese";
  for (const cuisine of pathCuisines) {
    const item = raw.personalized?.[cuisine];
    if (
      item &&
      pathDishIds[cuisine].includes(item.dishId) &&
      typeof item.reason === "string" &&
      (item.template === "learn" || item.template === "discover")
    ) {
      initial.personalized[cuisine] = {
        ...item,
        reason: item.reason.slice(0, 500),
        restaurantId:
          typeof item.restaurantId === "string" ? item.restaurantId : null,
      };
      if (completed.includes(personalizedId(cuisine)))
        initial.completed.push(personalizedId(cuisine));
    }
  }
  initial.bonusXp =
    typeof raw.bonusXp === "number" &&
    Number.isSafeInteger(raw.bonusXp) &&
    raw.bonusXp >= 0
      ? raw.bonusXp
      : 0;
  for (const challenge of challenges) {
    const run = raw.bonus?.[challenge.id];
    if (
      run &&
      typeof run.startedAt === "string" &&
      Number.isFinite(Date.parse(run.startedAt)) &&
      Array.isArray(run.visits)
    ) {
      const visits = run.visits.filter(
        (visit) =>
          visit &&
          typeof visit.id === "string" &&
          typeof visit.cuisine === "string" &&
          typeof visit.neighborhood === "string",
      );
      initial.bonus[challenge.id] = {
        startedAt: run.startedAt,
        visits: [
          ...new Map(
            visits.map((visit) => [
              visit.id,
              {
                ...visit,
                category:
                  typeof visit.category === "string" && visit.category
                    ? visit.category
                    : places.find((place) => place.id === visit.id)?.category ??
                      "",
              },
            ]),
          ).values(),
        ],
        claimed: run.claimed === true,
      };
    }
  }
  return initial;
}
export function questStatus(state: QuestState, quest: Quest) {
  if (state.completed.includes(quest.id)) return "completed";
  const path = questsFor(quest.cuisine);
  const index = path.findIndex((item) => item.id === quest.id);
  if (index < 0) return "locked";
  return index === 0 || state.completed.includes(path[index - 1]!.id)
    ? "current"
    : "locked";
}
export function completeQuest(state: QuestState, quest: Quest): QuestState {
  if (questStatus(state, quest) !== "current") return state;
  return { ...state, completed: [...state.completed, quest.id] };
}
export function pathProgress(state: QuestState, cuisine: PathCuisine) {
  const path = questsFor(cuisine);
  const completed = path.filter((quest) => state.completed.includes(quest.id));
  const xp =
    completed.reduce((sum, quest) => sum + quest.xp, 0) +
    (state.completed.includes(personalizedId(cuisine)) ? 60 : 0);
  return {
    count: completed.length,
    total: path.length,
    xp,
    level: Math.floor(xp / 200) + 1,
    levelXp: xp % 200,
    stamps: chapters.filter((_, index) =>
      state.completed.includes(path[index * 5 + 4]!.id),
    ).length,
  };
}
export function hasDish(entries: FoodEntry[], dishId: string) {
  const dish = catalogDishes.find((item) => item.id === dishId);
  const normalize = (text: string) =>
    text.trim().normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
  return (
    !!dish &&
    entries.some(
      (entry) =>
        dish.cuisineIds.includes(entry.cuisine) &&
        normalize(entry.name) === normalize(dish.name),
    )
  );
}
export function lessonFor(quest: Quest) {
  const dish = catalogDishes.find((item) => item.id === quest.dishId)!;
  const others = pathDishes(quest.cuisine).filter(
    (item) => item.id !== dish.id,
  );
  return {
    dish,
    others,
    question: `Which dish matches this description?\n“${dish.note}”`,
    options: [others[0]!, dish, ...others.slice(1)],
  };
}
export const bonusTargets: Record<string, number> = {
  "new-restaurants": 3,
  "neighbourhood-explorer": 2,
  "cuisine-collector": 5,
  "local-regular": 4,
  "coffee-break": 3,
  "sweet-tooth": 2,
  "breakfast-club": 3,
  "plant-powered": 3,
  "pizza-tour": 3,
  "lunch-break": 3,
  "new-flavours": 4,
  "dessert-month": 3,
};
export function bonusCount(id: string, run?: BonusRun) {
  if (!run) return 0;
  const challenge = challenges.find((item) => item.id === id);
  if (challenge?.metric === "neighbourhoods")
    return new Set(
      run.visits.map((visit) => visit.neighborhood).filter(Boolean),
    ).size;
  if (challenge?.metric === "cuisines")
    return new Set(run.visits.map((visit) => visit.cuisine).filter(Boolean))
      .size;
  if (challenge?.metric === "categories")
    return new Set(run.visits.map((visit) => visit.category).filter(Boolean))
      .size;
  if (challenge?.category)
    return new Set(
      run.visits
        .filter((visit) => visit.category === challenge.category)
        .map((visit) => visit.id),
    ).size;
  return new Set(run.visits.map((visit) => visit.id)).size;
}
export function bonusExpired(id: string, run: BonusRun, now = Date.now()) {
  const days =
    challenges.find((item) => item.id === id)?.cadence === "WEEKLY" ? 7 : 30;
  return now >= Date.parse(run.startedAt) + days * 86400000;
}
export function claimBonus(
  state: QuestState,
  id: string,
  now = Date.now(),
): QuestState {
  const run = state.bonus[id];
  const challenge = challenges.find((item) => item.id === id);
  if (
    !run ||
    !challenge ||
    run.claimed ||
    bonusExpired(id, run, now) ||
    bonusCount(id, run) < bonusTargets[id]!
  )
    return state;
  return {
    ...state,
    bonusXp: state.bonusXp + challenge.points,
    bonus: { ...state.bonus, [id]: { ...run, claimed: true } },
  };
}
