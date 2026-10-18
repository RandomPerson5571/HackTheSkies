import { useState } from "react";

// Slice-based paging for plain ScrollView lists. Screens that render the full
// restaurant catalog or a long activity feed mount every card on first paint
// and lag on low-end devices; paging keeps each render small without forcing
// those screens onto FlatList. Pass a resetKey (search query, filter id) to
// restart at page 1 whenever that view changes.
export function usePagedList<T>(
  items: readonly T[],
  pageSize: number,
  resetKey?: string | number,
) {
  const [page, setPage] = useState(1);
  const [key, setKey] = useState(resetKey);
  if (resetKey !== key) {
    setKey(resetKey);
    setPage(1);
  }
  const limit = page * pageSize;
  const visible = items.slice(0, limit);
  return {
    offset: limit - visible.length,
    visible,
    shown: visible.length,
    total: items.length,
    remaining: items.length - visible.length,
    hasMore: visible.length < items.length,
    loadMore: () => setPage((value) => value + 1),
  };
}
