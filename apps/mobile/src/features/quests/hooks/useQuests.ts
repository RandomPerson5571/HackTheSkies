import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initialQuests, parseQuests, type QuestState } from "../models/quests";

const KEY = "cibo.quests.v1";
type Snapshot = { state: QuestState; ready: boolean; error: string };
let snapshot: Snapshot = { state: initialQuests(), ready: false, error: "" };
const listeners = new Set<(value: Snapshot) => void>();
let loadStarted = false;
let pending: Promise<unknown> = Promise.resolve();

function publish(next: Snapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

function loadQuests() {
  if (loadStarted) return;
  loadStarted = true;
  pending = pending
    .catch(() => {})
    .then(async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        publish({
          state: raw ? parseQuests(JSON.parse(raw)) : initialQuests(),
          ready: true,
          error: "",
        });
      } catch {
        publish({
          ...snapshot,
          ready: true,
          error: "Couldn’t load quest progress on this device.",
        });
      }
    });
}

export function useQuests() {
  const [value, setValue] = useState(snapshot);
  useEffect(() => {
    const listener = (next: Snapshot) => setValue(next);
    listeners.add(listener);
    listener(snapshot);
    loadQuests();
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const update = useCallback((change: (previous: QuestState) => QuestState) => {
    if (!snapshot.ready) return;
    const nextState = change(snapshot.state);
    if (nextState === snapshot.state) return;
    publish({ ...snapshot, state: nextState });
    pending = pending
      .catch(() => {})
      .then(async () => {
        try {
          await AsyncStorage.setItem(KEY, JSON.stringify(nextState));
          publish({ ...snapshot, error: "" });
        } catch {
          publish({
            ...snapshot,
            error: "Quest progress hasn’t saved. Keep this screen open and try again.",
          });
        }
      });
  }, []);

  return {
    ...value,
    update,
    retry: () => update((state) => ({ ...state })),
  };
}
