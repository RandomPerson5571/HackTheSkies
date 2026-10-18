import { catalogDishes } from "../../../../../../packages/food-catalog/data/catalog.ts";
import { challenges } from "../data/challenges.ts";
import { places } from "../../restaurants/data/places.ts";

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
export type QuestState = {
  bonus: Record<string, BonusRun>;
  bonusXp: number;
};
export function initialQuests(): QuestState {
  return {
    bonus: {},
    bonusXp: 0,
  };
}
export function parseQuests(value: unknown): QuestState {
  const initial = initialQuests();
  if (!value || typeof value !== "object") return initial;
  const raw = value as Partial<QuestState>;
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
