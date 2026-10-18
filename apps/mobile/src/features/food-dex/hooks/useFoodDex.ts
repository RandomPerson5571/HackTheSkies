import { useState } from "react";
import { useGuestDocument } from "../../../hooks/useGuestDocument";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import {
  addFood,
  foodKey,
  parseFoodDex,
  updateFood,
  type Cuisine,
  type FoodEntry,
} from "../models/foodDex";

export type FoodDiscoveryResult = { entry: FoodEntry; updated: boolean };

function load() {
  try {
    if (Platform.OS === "web") {
      const raw = localStorage.getItem("food-dex");
      return { entries: raw ? parseFoodDex(raw) : [], error: "" };
    }
    const file = new File(Paths.document, "food-dex.json");
    return {
      entries: file.exists ? parseFoodDex(file.textSync()) : [],
      error: "",
    };
  } catch {
    return {
      entries: [] as FoodEntry[],
      error:
        "Your Food Dex couldn’t be loaded. New discoveries will stay in this session.",
    };
  }
}

export function useFoodDex() {
  const [photoWarning, setPhotoWarning] = useState("");
  const {
    value: entries,
    update,
    error,
  } = useGuestDocument(
    "foodDex",
    () => load().entries,
    (value) => parseFoodDex(JSON.stringify(value)),
    {
      // Images stay on this device; only discovery metadata goes to Postgres.
      serialize: (entries) => entries.map((entry) => ({ ...entry, photo: "" })),
      merge: (remote, local) =>
        remote.map((entry) => ({
          ...entry,
          photo: local.find((item) => item.id === entry.id)?.photo ?? "",
        })),
    },
  );

  function discover(
    name: string,
    cuisine: Cuisine,
    uri: string,
    review = "",
    location = "",
  ): FoodDiscoveryResult {
    // A dish already in the Dex is re-collected: the new review, location and
    // photo update its existing entry instead of being blocked as a duplicate.
    const existing = entries.find(
      (entry) =>
        foodKey(entry.name, entry.cuisine) === foodKey(name, cuisine),
    );
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let photo = uri;
    let photoError = "";
    if (uri && Platform.OS !== "web") {
      try {
        const destination = new File(
          Paths.document,
          `food-${existing?.id ?? id}.jpg`,
        );
        new File(uri).copySync(destination);
        photo = destination.uri;
      } catch {
        // Keep the entry durable even if the temporary photo cannot be copied.
        photo = "";
        photoError = existing
          ? "Your review was saved, but the new photo couldn’t be added."
          : "Your discovery was added, but its photo couldn’t be saved.";
      }
    }
    if (existing) {
      const merged: FoodEntry = {
        ...existing,
        photo: photo || existing.photo,
      };
      if (location.trim()) merged.location = location.trim().slice(0, 120);
      if (review.trim()) merged.review = review.trim().slice(0, 480);
      update(updateFood(entries, merged));
      setPhotoWarning(photoError);
      return { entry: merged, updated: true };
    }
    const entry: FoodEntry = {
      id,
      name,
      cuisine,
      photo,
      discoveredAt: new Date().toISOString(),
    };
    if (location.trim()) entry.location = location.trim().slice(0, 120);
    if (review.trim()) entry.review = review.trim().slice(0, 480);
    const next = addFood(entries, entry);
    update(next);
    setPhotoWarning(photoError);
    return { entry, updated: false };
  }

  function remove(id: string) {
    // Leave photo cleanup to a later sweep so a failed journal write cannot break a saved entry.
    update((previous) => previous.filter((entry) => entry.id !== id));
  }

  return { entries, error: error || photoWarning, discover, remove };
}
