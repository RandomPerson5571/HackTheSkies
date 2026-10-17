import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import {
  documentTask,
  readDocument,
  writeDocument,
  type Section,
} from "../lib/guestDocuments";

// Local-first journal with a durable dirty flag. Failed writes retry on the next
// edit, foreground event, or periodic retry while the app remains open.
export function useGuestDocument<T>(
  section: Section,
  initial: () => T,
  parse: (value: unknown) => T,
  options?: {
    serialize: (value: T) => unknown;
    merge: (remote: T, local: T) => T;
  },
) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const current = useRef(value);
  const revision = useRef(0);
  const ready = useRef(false);
  const mounted = useRef(false);
  const dirty = useRef(false);
  const parser = useRef(parse);
  const optionsRef = useRef(options);
  const cacheKey = `cibo.cloud.${section}`;
  const report = useCallback((message: string) => {
    if (mounted.current) setError(message);
  }, []);

  const sync = useCallback(
    () =>
      documentTask(section, async () => {
        if (!ready.current) return;
        if (!dirty.current) {
          const version = revision.current;
          try {
            const remote = await readDocument(section);
            if (revision.current !== version) return;
            if (remote !== null) {
              const parsed = parser.current(remote);
              current.current =
                optionsRef.current?.merge(parsed, current.current) ?? parsed;
              await AsyncStorage.setItem(
                cacheKey,
                JSON.stringify({ value: current.current, dirty: false }),
              );
              if (mounted.current) setValue(current.current);
              report("");
              return;
            }
            dirty.current = true;
          } catch {
            report(
              "Cloud sync is unavailable. You can keep using your journal on this device.",
            );
            return;
          }
        }
        const version = revision.current;
        const snapshot = current.current;
        try {
          await writeDocument(
            section,
            optionsRef.current?.serialize(snapshot) ?? snapshot,
          );
          if (revision.current === version) {
            await AsyncStorage.setItem(
              cacheKey,
              JSON.stringify({ value: snapshot, dirty: false }),
            );
            if (revision.current === version) {
              dirty.current = false;
              report("");
            }
          }
        } catch {
          report(
            "Cloud sync hasn’t completed. Keep the app open; we’ll retry automatically.",
          );
        }
      }),
    [section, cacheKey, report],
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void documentTask(section, async () => {
      const version = revision.current;
      try {
        const raw = await AsyncStorage.getItem(cacheKey);
        const cached = raw ? JSON.parse(raw) : null;
        if (cached && revision.current === version) {
          current.current = parser.current(cached.value);
          dirty.current = cached.dirty === true;
          if (!cancelled) setValue(current.current);
        }
        const remote = await readDocument(section);
        // Edits made during hydration always win over a late network response.
        if (revision.current === version && !dirty.current && remote !== null) {
          const parsed = parser.current(remote);
          current.current =
            optionsRef.current?.merge(parsed, current.current) ?? parsed;
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ value: current.current, dirty: false }),
          );
          if (!cancelled) setValue(current.current);
        } else if (remote === null) {
          dirty.current = true;
        }
        report("");
      } catch {
        report(
          "Cloud sync is unavailable. You can keep using your journal on this device.",
        );
      } finally {
        ready.current = true;
      }
    }).then(() => {
      if (!cancelled) void sync();
    });
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void sync();
    });
    const timer = setInterval(() => {
      void sync();
    }, 30000);
    return () => {
      cancelled = true;
      mounted.current = false;
      subscription.remove();
      clearInterval(timer);
    };
  }, [section, cacheKey, report, sync]);

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      const result =
        typeof next === "function"
          ? (next as (previous: T) => T)(current.current)
          : next;
      if (result === current.current) return;
      current.current = result;
      revision.current += 1;
      dirty.current = true;
      setValue(result);
      // The same queue preserves dirty-cache order when edits arrive quickly.
      void documentTask(section, async () => {
        try {
          await AsyncStorage.setItem(
            cacheKey,
            JSON.stringify({ value: current.current, dirty: true }),
          );
        } catch {
          report(
            "Couldn’t save on this device. Keep the app open until cloud sync succeeds.",
          );
        }
      }).then(() => sync());
    },
    [section, cacheKey, report, sync],
  );

  return { value, update, error };
}
