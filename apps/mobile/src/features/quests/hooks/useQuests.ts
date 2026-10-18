import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initialQuests, parseQuests, type QuestState } from "../models/quests";

const KEY = "cibo.quests.v1";
// One ordered queue survives screen remounts and prevents a late write from
// replacing a newer completion. Hydration finishes before any edits are allowed.
let pending: Promise<unknown> = Promise.resolve();
export function useQuests() {
  const [state, setState] = useState(initialQuests);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const current = useRef(state);
  const mounted = useRef(false);
  const readyRef = useRef(false);
  useEffect(() => {
    mounted.current = true;
    pending = pending
      .catch(() => {})
      .then(async () => {
        try {
          const raw = await AsyncStorage.getItem(KEY);
          const value = raw ? parseQuests(JSON.parse(raw)) : initialQuests();
          if (mounted.current) {
            current.current = value;
            setState(value);
          }
        } catch {
          if (mounted.current)
            setError("Couldn’t load quest progress on this device.");
        } finally {
          readyRef.current = true;
          if (mounted.current) setReady(true);
        }
      });
    return () => {
      mounted.current = false;
    };
  }, []);
  const update = useCallback((change: (previous: QuestState) => QuestState) => {
    if (!readyRef.current) return;
    const next = change(current.current);
    if (next === current.current) return;
    current.current = next;
    setState(next);
    pending = pending
      .catch(() => {})
      .then(async () => {
        try {
          await AsyncStorage.setItem(KEY, JSON.stringify(next));
          if (mounted.current) setError("");
        } catch {
          if (mounted.current)
            setError(
              "Quest progress hasn’t saved. Keep this screen open and try again.",
            );
        }
      });
  }, []);
  return {
    state,
    ready,
    error,
    update,
    retry: () => update((value) => ({ ...value })),
  };
}
