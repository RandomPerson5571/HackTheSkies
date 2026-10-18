import type { Award } from "../components/AwardPopup";
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  BADGES,
  applyDiscovery,
  applyRating,
  applySave,
  createInitialState,
  parseGamification,
  type GamificationState,
  type BadgeId,
} from "../models/gamification";

const KEY = "cibo.gamification";

export function useGamification() {
  const [state, setState] = useState<GamificationState>(createInitialState);
  const [awards, setAwards] = useState<Award[]>([]);
  const [ready, setReady] = useState(false);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw
          ? parseGamification(JSON.parse(raw))
          : createInitialState();
        if (!cancelled) setState(parsed);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((next: GamificationState, celebrate = true) => {
    const previous = stateRef.current;
    if (celebrate) {
      const unlocked: Award[] = next.badges
        .filter((id) => !previous.badges.includes(id))
        .map((id) => ({
          id: `${next.xp}-${id}`,
          kind: "badge",
          title: BADGES.find((badge) => badge.id === id)!.name,
          subtitle: BADGES.find((badge) => badge.id === id)!.description,
        }));
      if (next.level > previous.level)
        unlocked.push({
          id: `${next.xp}-level`,
          kind: "level",
          title: `Level ${next.level}`,
          subtitle: "Your next chapter starts here.",
        });
      if (unlocked.length) setAwards((queue) => [...queue, ...unlocked]);
    }
    stateRef.current = next;
    setState(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const onDiscovery = useCallback(
    (cuisineCount: number) => {
      const { state: next, unlocked } = applyDiscovery(
        stateRef.current,
        cuisineCount,
      );
      persist(next, false);
      return unlocked;
    },
    [persist],
  );

  const onSave = useCallback(() => {
    const { state: next, unlocked } = applySave(stateRef.current);
    persist(next);
    return unlocked;
  }, [persist]);

  const onRating = useCallback(() => {
    const { state: next, unlocked } = applyRating(stateRef.current);
    persist(next);
    return unlocked;
  }, [persist]);

  return {
    state,
    ready,
    onDiscovery,
    onSave,
    onRating,
    awards,
    enqueueAwards: (newAwards: Award[]) =>
      setAwards((queue) => [...queue, ...newAwards]),
    dismissAward: () => setAwards((queue) => queue.slice(1)),
  };
}

export type { BadgeId };
