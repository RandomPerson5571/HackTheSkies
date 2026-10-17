export type RestaurantList = { id: string; name: string; placeIds: string[] };
export type RestaurantCollection = {
  saved: string[];
  visited: string[];
  lists: RestaurantList[];
  ratings: Record<string, number>;
  favorites: string[];
  friendIds: string[];
};

export const emptyCollection: RestaurantCollection = {
  saved: [],
  visited: [],
  lists: [],
  ratings: {},
  favorites: [],
  friendIds: [],
};

export type CollectionAction =
  | { type: "rate"; placeId: string; rating: number }
  | { type: "rank"; placeId: string; direction: -1 | 1 }
  | { type: "friend"; friendId: string }
  | { type: "save"; placeId: string }
  | { type: "visit"; placeId: string }
  | { type: "create-list"; id: string; name: string }
  | { type: "membership"; listId: string; placeId: string };

export function updateCollection(
  state: RestaurantCollection,
  action: CollectionAction,
): RestaurantCollection {
  if (action.type === "friend") {
    return {
      ...state,
      friendIds: state.friendIds.includes(action.friendId)
        ? state.friendIds.filter((id) => id !== action.friendId)
        : [...state.friendIds, action.friendId],
    };
  }
  if (action.type === "rate") {
    if (
      !Number.isInteger(action.rating) ||
      action.rating < 0 ||
      action.rating > 5
    )
      return state;
    const ratings = { ...state.ratings };
    if (action.rating === 0) {
      delete ratings[action.placeId];
      return {
        ...state,
        ratings,
        favorites: state.favorites.filter((id) => id !== action.placeId),
      };
    }
    ratings[action.placeId] = action.rating;
    return {
      ...state,
      ratings,
      saved: [...new Set([...state.saved, action.placeId])],
      visited: [...new Set([...state.visited, action.placeId])],
      favorites: [...new Set([...state.favorites, action.placeId])],
    };
  }
  if (action.type === "rank") {
    const index = state.favorites.indexOf(action.placeId);
    const target = index + action.direction;
    if (index < 0 || target < 0 || target >= state.favorites.length)
      return state;
    const favorites = [...state.favorites];
    [favorites[index], favorites[target]] = [
      favorites[target]!,
      favorites[index]!,
    ];
    return { ...state, favorites };
  }
  if (action.type === "create-list") {
    const name = action.name.trim().slice(0, 40);
    if (
      !name ||
      state.lists.some(
        (list) =>
          list.id === action.id ||
          list.name.toLowerCase() === name.toLowerCase(),
      )
    )
      return state;
    return {
      ...state,
      lists: [...state.lists, { id: action.id, name, placeIds: [] }],
    };
  }
  const id = action.placeId;
  const saved = state.saved.includes(id) ? state.saved : [...state.saved, id];
  if (action.type === "save") {
    if (!state.saved.includes(id)) return { ...state, saved };
    return {
      ...state,
      saved: state.saved.filter((item) => item !== id),
      visited: state.visited.filter((item) => item !== id),
      ratings: Object.fromEntries(
        Object.entries(state.ratings).filter(([key]) => key !== id),
      ),
      favorites: state.favorites.filter((item) => item !== id),
      lists: state.lists.map((list) => ({
        ...list,
        placeIds: list.placeIds.filter((item) => item !== id),
      })),
    };
  }
  if (action.type === "visit") {
    return {
      ...state,
      saved,
      visited: state.visited.includes(id)
        ? state.visited.filter((item) => item !== id)
        : [...state.visited, id],
      ratings: state.visited.includes(id)
        ? Object.fromEntries(
            Object.entries(state.ratings).filter(([key]) => key !== id),
          )
        : state.ratings,
      favorites: state.visited.includes(id)
        ? state.favorites.filter((item) => item !== id)
        : state.favorites,
    };
  }
  if (!state.lists.some((list) => list.id === action.listId)) return state;
  return {
    ...state,
    saved,
    lists: state.lists.map((list) =>
      list.id === action.listId
        ? {
            ...list,
            placeIds: list.placeIds.includes(id)
              ? list.placeIds.filter((item) => item !== id)
              : [...list.placeIds, id],
          }
        : list,
    ),
  };
}

export function parseCollection(
  raw: string,
  validIds: string[],
): RestaurantCollection {
  const data: unknown = JSON.parse(raw);
  if (!data || typeof data !== "object")
    throw new Error("Invalid restaurant collection");
  const value = data as Record<string, unknown>;
  const ids = (items: unknown): string[] => {
    if (!Array.isArray(items) || !items.every((id) => typeof id === "string"))
      throw new Error("Invalid restaurant IDs");
    return [...new Set(items as string[])].filter((id) =>
      validIds.includes(id),
    );
  };
  const saved = ids(value.saved);
  const visited = ids(value.visited).filter((id) => saved.includes(id));
  if (!Array.isArray(value.lists)) throw new Error("Invalid restaurant lists");
  const lists: RestaurantList[] = value.lists.map((list: unknown) => {
    if (
      !list ||
      typeof list !== "object" ||
      !("id" in list) ||
      typeof list.id !== "string" ||
      !("name" in list) ||
      typeof list.name !== "string" ||
      !list.name.trim() ||
      !("placeIds" in list)
    )
      throw new Error("Invalid restaurant list");
    return {
      id: list.id,
      name: list.name.trim().slice(0, 40),
      placeIds: ids(list.placeIds).filter((id) => saved.includes(id)),
    };
  });
  if (new Set(lists.map((list) => list.id)).size !== lists.length)
    throw new Error("Duplicate list ID");
  // Older snapshots predate ratings and friends; keep their saved places intact.
  const ratings: Record<string, number> = {};
  if (
    value.ratings &&
    typeof value.ratings === "object" &&
    !Array.isArray(value.ratings)
  ) {
    for (const [id, rating] of Object.entries(value.ratings)) {
      if (
        visited.includes(id) &&
        typeof rating === "number" &&
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5
      )
        ratings[id] = rating;
    }
  }
  const favorites = [
    ...new Set([
      ...(value.favorites === undefined ? [] : ids(value.favorites)).filter(
        (id) => ratings[id],
      ),
      ...Object.keys(ratings),
    ]),
  ];
  const friendIds = Array.isArray(value.friendIds)
    ? [
        ...new Set(
          value.friendIds.filter((id): id is string => typeof id === "string"),
        ),
      ]
    : [];
  return { saved, visited, lists, ratings, favorites, friendIds };
}
