import { useCallback } from "react";
import { useGuestDocument } from "../../../hooks/useGuestDocument";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { playFeedback } from "../../../lib/sensory";
import { places } from "../data/places";
import {
  emptyCollection,
  parseCollection,
  updateCollection,
  type CollectionAction,
} from "../models/restaurantCollection";

const browserStorageKey = "cibo.restaurantCollection";

function load() {
  try {
    const file =
      Platform.OS === "web"
        ? null
        : new File(Paths.document, "restaurants.json");
    const raw =
      Platform.OS === "web"
        ? localStorage.getItem(browserStorageKey)
        : file?.exists
          ? file.textSync()
          : null;
    return {
      collection:
        raw !== null
          ? parseCollection(
              raw,
              places.map((place) => place.id),
            )
          : emptyCollection,
      error: "",
    };
  } catch {
    return {
      collection: emptyCollection,
      error:
        "Your food journal couldn’t be loaded. Changes will be kept for this session.",
    };
  }
}

export function useRestaurantCollection() {
  const {
    value: collection,
    update,
    error,
  } = useGuestDocument(
    "collection",
    () => load().collection,
    (value) =>
      parseCollection(
        JSON.stringify(value),
        places.map((place) => place.id),
      ),
  );
  const dispatch = useCallback(
    (action: CollectionAction) => {
      if (
        action.type === "save" &&
        !collection.saved.includes(action.placeId)
      ) {
        void playFeedback("openBook");
      }
      update((previous) => updateCollection(previous, action));
    },
    [collection.saved, update],
  );
  return { collection, dispatch, storageError: error };
}
