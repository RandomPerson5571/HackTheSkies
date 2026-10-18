import { foodKey, type FoodEntry } from "../../food-dex/models/foodDex.ts";
import { pathCuisines, pathDishes, type PathCuisine } from "./quests.ts";

export type CollectionQuest = {
  id: string;
  title: string;
  hint: string;
  reward: string;
  xp: number;
  target: number;
  cuisine?: PathCuisine;
  dishes?: string[];
  metric:
    | "cuisine"
    | "ramen"
    | "dessert"
    | "world"
    | "set"
    | "restaurants"
    | "discoveries"
    | "home"
    | "days";
};
export const collectionQuests: CollectionQuest[] = [
  {
    id: "new-tables",
    title: "New Tables",
    hint: "Visit 3 different restaurants",
    reward: "Restaurant Rover",
    xp: 150,
    target: 3,
    metric: "restaurants",
  },
  {
    id: "city-taster",
    title: "City Taster",
    hint: "Visit 10 different restaurants",
    reward: "Local Legend",
    xp: 300,
    target: 10,
    metric: "restaurants",
  },
  {
    id: "five-finds",
    title: "Five Finds",
    hint: "Collect 5 different dishes",
    reward: "Curious Collector",
    xp: 100,
    target: 5,
    metric: "discoveries",
  },
  {
    id: "full-album",
    title: "Full Album",
    hint: "Collect 10 different dishes",
    reward: "Memory Maker",
    xp: 200,
    target: 10,
    metric: "discoveries",
  },
  {
    id: "home-chef",
    title: "Home Chef",
    hint: "Collect 3 home-cooked dishes",
    reward: "Kitchen Creative",
    xp: 150,
    target: 3,
    metric: "home",
  },
  {
    id: "daily-discoveries",
    title: "Daily Discoveries",
    hint: "Collect food on 3 different days",
    reward: "Everyday Explorer",
    xp: 100,
    target: 3,
    metric: "days",
  },
  ...pathCuisines.map((cuisine): CollectionQuest => ({
    id: `first-${cuisine}`,
    title: `First Bite · ${cuisine}`,
    hint: `Collect any ${cuisine} dish`,
    reward: `${cuisine} Explorer`,
    xp: 50,
    target: 1,
    cuisine,
    metric: "cuisine",
  })),
  {
    id: "ramen-run",
    title: "Ramen Run",
    hint: "Collect 3 different ramen dishes",
    reward: "Ramen Regular",
    xp: 150,
    target: 3,
    cuisine: "Japanese",
    metric: "ramen",
  },
  {
    id: "sweet-finish",
    title: "Sweet Finish",
    hint: "Collect 2 Italian desserts",
    reward: "Sweet Tooth",
    xp: 100,
    target: 2,
    cuisine: "Italian",
    metric: "dessert",
  },
  {
    id: "around-the-world",
    title: "Around the World",
    hint: "Collect dishes from 5 cuisines",
    reward: "World Explorer",
    xp: 250,
    target: 5,
    metric: "world",
  },
  ...pathCuisines.map((cuisine): CollectionQuest => ({
    id: `table-${cuisine}`,
    title: `${cuisine} Table`,
    hint: "Complete the set",
    reward: `${cuisine} Passport Stamp`,
    xp: 200,
    target: pathDishes(cuisine).length,
    cuisine,
    metric: "set",
    dishes: pathDishes(cuisine).map((dish) => dish.id),
  })),
];
const normalize = (value: string) =>
  value.normalize("NFKC").trim().toLocaleLowerCase().replace(/\s+/g, " ");
export function questEntries(quest: CollectionQuest, entries: FoodEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key =
      quest.metric === "world"
        ? entry.cuisine
        : quest.metric === "days"
          ? entry.discoveredAt.slice(0, 10)
          : foodKey(entry.name, entry.cuisine);
    if (seen.has(key)) return false;
    const name = normalize(entry.name);
    const matches =
      quest.metric === "world" ||
      quest.metric === "discoveries" ||
      (quest.metric === "days" &&
        !Number.isNaN(Date.parse(entry.discoveredAt))) ||
      (quest.metric === "home" &&
        /^(home|home kitchen|home[- ]cooked|homemade|my kitchen|at home)$/i.test(
          entry.location?.trim() ?? "",
        )) ||
      ((!quest.cuisine || quest.cuisine === entry.cuisine) &&
        (quest.metric === "cuisine" ||
          (quest.metric === "ramen" && /\bramen\b/.test(name)) ||
          (quest.metric === "dessert" &&
            /\b(tiramis[uù]|gelato|cannoli|panna cotta|semifreddo|affogato|pizzelle|zeppole|biscotti)\b/.test(
              name,
            )) ||
          (quest.metric === "set" &&
            pathDishes(quest.cuisine!).some(
              (dish) =>
                quest.dishes?.includes(dish.id) &&
                normalize(dish.name) === name,
            ))));
    if (matches) seen.add(key);
    return matches;
  });
}
export function collectionQuestProgress(
  quest: CollectionQuest,
  entries: FoodEntry[],
  visited: string[] = [],
) {
  const collected = questEntries(quest, entries);
  const count = Math.min(
    quest.target,
    quest.metric === "restaurants"
      ? new Set(visited.filter(Boolean)).size
      : collected.length,
  );
  return { collected, count, complete: count === quest.target };
}
export function advancedCollectionQuests(
  before: FoodEntry[],
  after: FoodEntry[],
) {
  return collectionQuests.filter(
    (quest) =>
      collectionQuestProgress(quest, after).count >
      collectionQuestProgress(quest, before).count,
  );
}

export function collectionQuestXp(
  entries: FoodEntry[],
  visited: string[] = [],
) {
  return collectionQuests.reduce(
    (xp, quest) =>
      xp +
      (collectionQuestProgress(quest, entries, visited).complete
        ? quest.xp
        : 0),
    0,
  );
}
