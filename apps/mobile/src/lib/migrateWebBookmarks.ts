import {
  emptyCollection,
  parseCollection,
} from "../features/restaurants/models/restaurantCollection.ts";
type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
};
const legacyKey = "cibo:web:saved-restaurants";
const markerKey = "cibo.webBookmarksImported";
const cacheKey = "cibo.cloud.collection";

export async function migrateWebBookmarks(
  storage: Storage,
  validIds: string[],
) {
  if (await storage.getItem(markerKey)) return;
  const legacyRaw = await storage.getItem(legacyKey);
  if (!legacyRaw) return;
  const legacy: unknown = JSON.parse(legacyRaw);
  if (!Array.isArray(legacy) || !legacy.every((id) => typeof id === "string"))
    throw new Error("Invalid legacy bookmarks");
  const cacheRaw = await storage.getItem(cacheKey);
  const cache = cacheRaw ? JSON.parse(cacheRaw) : null;
  const oldRaw = cache
    ? null
    : await storage.getItem("cibo.restaurantCollection");
  const collection = parseCollection(
    JSON.stringify(
      cache?.value ?? (oldRaw ? JSON.parse(oldRaw) : emptyCollection),
    ),
    validIds,
  );
  const saved = [
    ...new Set([
      ...collection.saved,
      ...legacy.filter((id) => validIds.includes(id)),
    ]),
  ];
  // Persist before marking imported. A failed write leaves the source intact.
  await storage.setItem(
    cacheKey,
    JSON.stringify({ value: { ...collection, saved }, dirty: true }),
  );
  await storage.setItem(markerKey, "1");
}
