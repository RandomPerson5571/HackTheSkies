import { useRef, useState } from "react";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import {
  addFood,
  foodKey,
  parseFoodDex,
  type Cuisine,
  type FoodEntry,
} from "../models/foodDex";

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
  const [state, setState] = useState(load);
  const current = useRef(state.entries);
  const readFailed = useRef(Boolean(state.error));

  function persist(entries: FoodEntry[], photoError = "") {
    let error = photoError;
    if (readFailed.current)
      error =
        "Your Food Dex couldn’t be loaded. New discoveries will stay in this session.";
    else {
      try {
        if (Platform.OS === "web")
          localStorage.setItem("food-dex", JSON.stringify(entries));
        else {
          const next = new File(Paths.document, "food-dex-next.json");
          next.write(JSON.stringify(entries));
          next.moveSync(new File(Paths.document, "food-dex.json"), {
            overwrite: true,
          });
        }
      } catch {
        error =
          "Couldn’t save your Food Dex on this device. Your discoveries are available for this session.";
      }
    }
    current.current = entries;
    setState({ entries, error });
  }

  function discover(name: string, cuisine: Cuisine, uri: string) {
    if (
      current.current.some(
        (entry) =>
          foodKey(entry.name, entry.cuisine) === foodKey(name, cuisine),
      )
    )
      return false;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    let photo = uri;
    let photoError = "";
    if (uri && Platform.OS !== "web") {
      try {
        const destination = new File(Paths.document, `food-${id}.jpg`);
        new File(uri).copy(destination);
        photo = destination.uri;
      } catch {
        // Keep the entry durable even if the temporary photo cannot be copied.
        photo = "";
        photoError =
          "Your discovery was added, but its photo couldn’t be saved.";
      }
    }
    const entries = addFood(current.current, {
      id,
      name,
      cuisine,
      photo,
      discoveredAt: new Date().toISOString(),
    });
    persist(entries, photoError);
    return true;
  }

  function remove(id: string) {
    // Leave photo cleanup to a later sweep so a failed journal write cannot break a saved entry.
    persist(current.current.filter((entry) => entry.id !== id));
  }

  return { ...state, discover, remove };
}
