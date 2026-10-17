import { useCallback, useRef, useState } from "react";
import { File, Paths } from "expo-file-system";
import { places } from "./places";
import {
  emptyCollection,
  parseCollection,
  updateCollection,
  type CollectionAction,
} from "./restaurantCollection";

function load() {
  try {
    const file = new File(Paths.document, "restaurants.json");
    return {
      collection: file.exists
        ? parseCollection(
            file.textSync(),
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
  const [state, setState] = useState(load);
  const current = useRef(state.collection);
  const readFailed = useRef(Boolean(state.error));

  const dispatch = useCallback((action: CollectionAction) => {
    const collection = updateCollection(current.current, action);
    if (collection === current.current) return;
    current.current = collection;
    let error = "";
    if (readFailed.current) {
      // Preserve an unreadable file rather than overwriting the user's saved data.
      error =
        "Your food journal couldn’t be loaded. Changes will be kept for this session.";
    } else {
      try {
        const file = new File(Paths.document, "restaurants.json");
        const next = new File(Paths.document, "restaurants-next.json");
        next.write(JSON.stringify(collection));
        next.moveSync(file, { overwrite: true });
      } catch {
        error =
          "Couldn’t save your food journal on this device. Your changes are available for this session.";
      }
    }
    setState({ collection, error });
  }, []);

  return { collection: state.collection, dispatch, storageError: state.error };
}
