import {
  collectionQuests,
  advancedCollectionQuests,
  collectionQuestProgress,
  collectionQuestXp,
} from "../../quests/models/collectionQuests.ts";
import type { FoodEntry } from "../../food-dex/models/foodDex.ts";
import { levelForXp, XP_PER_DISCOVERY } from "./gamification.ts";

export type Award = {
  id: string;
  kind: "quest" | "level" | "badge";
  title: string;
  subtitle: string;
  xp?: number;
};

// Compare the two confirmed collections; opening the quests screen never earns an award.
export function discoveryAwards(
  before: FoodEntry[],
  after: FoodEntry[],
  entryId: string,
  gameXp: number,
  visited: string[] = [],
): Award[] {
  const quests = advancedCollectionQuests(before, after).filter(
    (quest) => collectionQuestProgress(quest, after).complete,
  );
  const awards: Award[] = quests.map((quest) => ({
    id: `${entryId}-${quest.id}`,
    kind: "quest",
    title: quest.title,
    subtitle: quest.reward,
    xp: quest.xp,
  }));
  if (
    before.some((entry) => entry.id === entryId) ||
    !after.some((entry) => entry.id === entryId)
  )
    return [];
  const previousXp =
    Math.max(0, gameXp - XP_PER_DISCOVERY) + collectionQuestXp(before, visited);
  const nextXp = gameXp + collectionQuestXp(after, visited);
  if (levelForXp(nextXp) > levelForXp(previousXp))
    awards.push({
      id: `${entryId}-level`,
      kind: "level",
      title: `Level ${levelForXp(nextXp)}`,
      subtitle: "Your next chapter starts here.",
    });
  return awards;
}

export function restaurantQuestAwards(
  before: string[],
  after: string[],
  entries: FoodEntry[],
  gameXp: number,
): Award[] {
  const awards: Award[] = [];
  for (const quest of advancedRestaurantQuests(before, after)) {
    awards.push({
      id: `${quest.id}-${after.length}`,
      kind: "quest",
      title: quest.title,
      subtitle: quest.reward,
      xp: quest.xp,
    });
  }
  const previousXp = gameXp + collectionQuestXp(entries, before);
  const nextXp = gameXp + collectionQuestXp(entries, after);
  if (levelForXp(nextXp) > levelForXp(previousXp))
    awards.push({
      id: `restaurant-level-${nextXp}`,
      kind: "level",
      title: `Level ${levelForXp(nextXp)}`,
      subtitle: "Your next chapter starts here.",
    });
  return awards;
}

function advancedRestaurantQuests(before: string[], after: string[]) {
  return collectionQuests.filter(
    (quest) =>
      quest.metric === "restaurants" &&
      !collectionQuestProgress(quest, [], before).complete &&
      collectionQuestProgress(quest, [], after).complete,
  );
}
