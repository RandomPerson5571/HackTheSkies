import { playFeedback } from "../../../lib/sensory";
import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
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
        const parsed = raw ? parseGamification(JSON.parse(raw)) : createInitialState();
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

  const persist = useCallback((next: GamificationState) => {
    const previous = stateRef.current;
    if (next.level > previous.level) {
      void playFeedback("bell");
    } else if (next.badges.some((badge) => !previous.badges.includes(badge))) {
      void playFeedback("badge");
    }
    stateRef.current = next;
    setState(next);
    void AsyncStorage.setItem(KEY, JSON.stringify(next));
  }, []);

  const onDiscovery = useCallback(
    (cuisineCount: number) => {
      const { state: next, unlocked } = applyDiscovery(stateRef.current, cuisineCount);
      persist(next);
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

  return { state, ready, onDiscovery, onSave, onRating };
}

export type { BadgeId };
