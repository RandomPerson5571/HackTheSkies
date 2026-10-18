import type { FoodEntry } from "../../food-dex/models/foodDex.ts";
import { collectionQuestXp } from "../../quests/models/collectionQuests.ts";
import type { QuestState } from "../../quests/models/quests.ts";
import { rankForXp } from "../../profile/models/customization.ts";
import { levelForXp, xpToNextLevel } from "./gamification.ts";

// Profile and quests share the same sources and level thresholds.
export function playerProgress(
  gameXp: number,
  quests: QuestState,
  entries: FoodEntry[],
  visited: string[] = [],
) {
  const legacyXp = quests.bonusXp;
  const totalXp =
    Math.max(0, gameXp) + legacyXp + collectionQuestXp(entries, visited);
  return {
    totalXp,
    level: levelForXp(totalXp),
    rank: rankForXp(totalXp),
    xp: xpToNextLevel(totalXp),
  };
}
