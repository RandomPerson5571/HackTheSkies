import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import {
  places as bundledPlaces,
  type Place,
} from "../features/restaurants/data/places";
import {
  sampleFriends,
  type SampleFriend,
} from "../features/community/models/community";
import { supabase } from "./supabase";
import { mapViewportKey } from "./mapViewport";
import {
  canLoadMapRestaurants,
  fetchMapRestaurants,
  mergeMapRestaurants,
  withinBounds,
  discoveryBounds,
  discoveryKey,
  isTorontoDemo,
  isTorontoOnly,
} from "./mapRestaurants";

export type MapBounds = [
  west: number,
  south: number,
  east: number,
  north: number,
];
export type RestaurantPage = { places: Place[]; total: number };
type Catalog = {
  places: Place[];
  mapPlaces: Place[];
  mapCount: number | null;
  mapNeedsZoom: boolean;
  mapLoading: boolean;
  mapLoadError: string;
  retryMapRestaurants: () => void;
  loadMapViewport: (bounds: MapBounds, zoom: number) => Promise<void>;
  loadFavoritesPage: (
    query: string,
    offset: number,
    excludedIds: string[],
    options?: {
      limit?: number;
      randomize?: boolean;
      center?: [number, number];
      radiusKm?: number;
    },
  ) => Promise<RestaurantPage>;
  loadPlacesByIds: (ids: string[]) => Promise<Place[]>;
  friends: SampleFriend[];
  error: string;
};
const Backend = createContext<Catalog>({
  places: bundledPlaces,
  mapPlaces: [],
  mapCount: null,
  mapNeedsZoom: true,
  mapLoading: false,
  mapLoadError: "",
  retryMapRestaurants: () => {},
  loadMapViewport: async () => {},
  loadFavoritesPage: async () => ({ places: [], total: 0 }),
  loadPlacesByIds: async () => [],
  friends: sampleFriends,
  error: "",
});
export function useBackend() {
  return useContext(Backend);
}

export function BackendProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>({
    places: bundledPlaces,
    mapPlaces: [],
    mapCount: null,
    mapNeedsZoom: true,
    mapLoading: false,
    mapLoadError: "",
    retryMapRestaurants: () => {},
    loadMapViewport: async () => {},
    loadFavoritesPage: async () => ({ places: [], total: 0 }),
    loadPlacesByIds: async () => [],
    friends: sampleFriends,
    error: "",
  });
  const mapRequest = useRef(0);
  const discoveredPlaces = useRef<Place[]>([]);
  const discoveryRequest = useRef<AbortController | null>(null);
  const discoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const discoveryCache = useRef(new Map<string, number>());
  const mapQueryKey = useRef("");
  const lastViewport = useRef<{ bounds: MapBounds; zoom: number } | null>(null);
  const storageReady = useRef<Promise<void>>(Promise.resolve());
  const [mapLoading, setMapLoading] = useState(false);
  const [mapLoadError, setMapLoadError] = useState("");
  useEffect(() => {
    let active = true;
    storageReady.current = AsyncStorage.getItem("cibo.mapDiscovery.v1")
      .then((value) => {
        if (!active || !value) return;
        const stored = JSON.parse(value);
        if (
          !Number.isFinite(stored.savedAt) ||
          Date.now() - stored.savedAt > 86_400_000 ||
          !Array.isArray(stored.places)
        )
          return;
        const restored: Place[] = stored.places.filter(
          (place: Place) =>
            place &&
            typeof place.id === "string" &&
            typeof place.name === "string" &&
            Array.isArray(place.coordinate) &&
            place.coordinate.length === 2 &&
            place.coordinate.every(Number.isFinite) &&
            !isTorontoDemo(place),
        );
        discoveredPlaces.current = mergeMapRestaurants(
          restored,
          discoveredPlaces.current,
        ).slice(-2000);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const [mapPlaces, setMapPlaces] = useState<Place[]>([]);
  const [mapCount, setMapCount] = useState<number | null>(null);
  const [mapNeedsZoom, setMapNeedsZoom] = useState(true);
  const loadFavoritesPage = useCallback(
    async (
      query: string,
      offset: number,
      excludedIds: string[],
      options: {
        limit?: number;
        randomize?: boolean;
        center?: [number, number];
        radiusKm?: number;
      } = {},
    ) => {
      const normalizedQuery = query.trim();
      const limit = Math.max(1, Math.min(20, options.limit ?? 20));
      try {
        if (!supabase) throw new Error("Missing Supabase configuration");
        const { data, error } = await supabase.rpc("cibo_favorites_page", {
          p_query: normalizedQuery,
          p_offset: Math.max(0, Math.floor(offset)),
          p_limit: limit,
          p_excluded_ids: excludedIds,
          p_randomize: options.randomize ?? false,
          p_center_lon: options.center?.[0] ?? null,
          p_center_lat: options.center?.[1] ?? null,
          p_radius_km: options.radiusKm ?? null,
        });
        if (error) throw error;
        const result = data as { total?: number; places?: unknown } | null;
        const rows = Array.isArray(result?.places) ? result.places : [];
        const pagePlaces = rows.flatMap((row) => {
          const place =
            row && typeof row === "object"
              ? (row as { data?: Place }).data
              : null;
          return place &&
            typeof place.id === "string" &&
            Array.isArray(place.coordinate)
            ? [place]
            : [];
        });
        const total = Number(result?.total);
        return {
          places: pagePlaces,
          total: Number.isFinite(total) ? total : 0,
        };
      } catch {
        const excluded = new Set(excludedIds);
        const needle = normalizedQuery.toLowerCase();
        const matching = bundledPlaces.filter((place) => {
          if (
            excluded.has(place.id) ||
            !`${place.name} ${place.category}`.toLowerCase().includes(needle)
          )
            return false;
          if (options.center && options.radiusKm) {
            const [lon, lat] = place.coordinate;
            const [centerLon, centerLat] = options.center;
            const northKm = (lat - centerLat) * 111.32;
            const eastKm =
              (lon - centerLon) *
              111.32 *
              Math.cos((centerLat * Math.PI) / 180);
            if (northKm * northKm + eastKm * eastKm > options.radiusKm ** 2)
              return false;
          }
          return true;
        });
        if (options.randomize) matching.sort(() => Math.random() - 0.5);
        const start = Math.max(0, Math.floor(offset));
        return {
          places: matching.slice(start, start + limit),
          total: matching.length,
        };
      }
    },
    [],
  );
  const loadPlacesByIds = useCallback(async (ids: string[]) => {
    if (!ids.length) return [];
    await storageReady.current;
    try {
      if (!supabase) throw new Error("Missing Supabase configuration");
      const { data, error } = await supabase
        .from("cibo_restaurants")
        .select("id,data")
        .in("id", ids);
      if (error) throw error;
      const byId = new Map<string, Place>([
        ...mergeMapRestaurants(bundledPlaces, discoveredPlaces.current).map(
          (place) => [place.id, place] as const,
        ),
        ...(data ?? []).flatMap((row) => {
          const place = row.data as Place;
          return place && Array.isArray(place.coordinate)
            ? [[row.id, place] as const]
            : [];
        }),
      ]);
      return ids.flatMap((id) => {
        const place = byId.get(id);
        return place ? [place] : [];
      });
    } catch {
      const byId = new Map(
        mergeMapRestaurants(bundledPlaces, discoveredPlaces.current).map(
          (place) => [place.id, place],
        ),
      );
      return ids.flatMap((id) => {
        const place = byId.get(id);
        return place ? [place] : [];
      });
    }
  }, []);
  const loadMapViewport = useCallback(
    async (bounds: MapBounds, zoom: number) => {
      lastViewport.current = { bounds, zoom };
      const queryKey = mapViewportKey(bounds, zoom);
      if (queryKey === mapQueryKey.current) return;
      mapQueryKey.current = queryKey;
      const request = ++mapRequest.current;
      discoveryRequest.current?.abort();
      if (discoveryTimer.current) clearTimeout(discoveryTimer.current);
      setMapLoading(false);
      setMapLoadError("");
      const torontoOnly = isTorontoOnly(bounds);
      const eligible = canLoadMapRestaurants(discoveryBounds(bounds), zoom);
      setMapNeedsZoom(!torontoOnly && !eligible);
      await storageReady.current;
      if (request !== mapRequest.current) return;
      const inBounds = (place: Place) => withinBounds(place, bounds);
      // Toronto always uses CSV data, even in a view that spans its boundary.
      const localPlaces = mergeMapRestaurants(
        bundledPlaces,
        discoveredPlaces.current.filter((place) => !isTorontoDemo(place)),
      ).filter(inBounds);
      setMapPlaces(localPlaces);
      setMapCount(localPlaces.length);
      if (torontoOnly || !eligible) return;
      const key = discoveryKey(bounds);
      if (Date.now() - (discoveryCache.current.get(key) ?? 0) < 600_000) return;
      const controller = new AbortController();
      discoveryRequest.current = controller;
      setMapLoading(true);
      discoveryTimer.current = setTimeout(async () => {
        const timeout = setTimeout(() => controller.abort(), 25_000);
        try {
          const found = (
            await fetchMapRestaurants(bounds, controller.signal)
          ).filter((place) => !isTorontoDemo(place));
          if (request !== mapRequest.current) return;
          const merged = mergeMapRestaurants(discoveredPlaces.current, found);
          discoveredPlaces.current = merged;
          discoveryCache.current.set(key, Date.now());
          if (discoveryCache.current.size > 64)
            discoveryCache.current.delete(
              discoveryCache.current.keys().next().value!,
            );
          const visible = mergeMapRestaurants(
            bundledPlaces,
            discoveredPlaces.current,
          ).filter(inBounds);
          setMapPlaces(visible);
          setMapCount(visible.length);
          // Keep recent discoveries available after reopening the app.
          await AsyncStorage.setItem(
            "cibo.mapDiscovery.v1",
            JSON.stringify({
              savedAt: Date.now(),
              places: discoveredPlaces.current.slice(-2000),
            }),
          ).catch(() => {});
        } catch (error) {
          if (request === mapRequest.current) {
            mapQueryKey.current = "";
            setMapLoadError(
              error instanceof Error && error.name !== "AbortError"
                ? error.message
                : "Restaurants couldn’t load. Please retry.",
            );
          }
        } finally {
          clearTimeout(timeout);
          if (request === mapRequest.current) setMapLoading(false);
        }
      }, 700);
    },
    [],
  );
  const retryMapRestaurants = useCallback(() => {
    const viewport = lastViewport.current;
    if (!viewport) return;
    discoveryCache.current.delete(discoveryKey(viewport.bounds));
    mapQueryKey.current = "";
    void loadMapViewport(viewport.bounds, viewport.zoom);
  }, [loadMapViewport]);

  useEffect(
    () => () => {
      mapRequest.current += 1;
      discoveryRequest.current?.abort();
      if (discoveryTimer.current) clearTimeout(discoveryTimer.current);
    },
    [],
  );

  useEffect(() => {
    let active = true;
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        if (!supabase) throw new Error("Missing Supabase configuration");
        const [reviewers, reviews] = await Promise.all([
          supabase.from("cibo_reviewers").select("*").order("name"),
          supabase
            .from("cibo_reviews")
            .select("*")
            .order("visited_at", { ascending: false })
            .limit(120),
        ]);
        for (const result of [reviewers, reviews])
          if (result.error) throw result.error;
        const friends: SampleFriend[] = (reviewers.data ?? []).map((row) => {
          const avatarUri =
            (typeof row.avatar_url === "string" && row.avatar_url) ||
            `https://i.pravatar.cc/150?u=${row.id}`;
          return {
            id: row.id,
            name: row.name,
            handle: row.handle,
            initials: row.initials,
            bio: row.bio,
            avatarUri,
            profilePictureUri: avatarUri,
            profilePicture: avatarUri,
            avatarUrl: avatarUri,
            photoUrl: avatarUri,
            imageUrl: avatarUri,
            imageUri: avatarUri,
            visits: (reviews.data ?? [])
              .filter((review) => review.reviewer_id === row.id)
              .map((review) => {
                const note = review.note;
                return {
                  placeId: review.restaurant_id,
                  rating: review.rating,
                  note,
                  comment: note,
                  review: note,
                  text: note,
                  when: new Date(review.visited_at).toLocaleDateString("en-CA"),
                };
              }),
          };
        });
        if (active)
          setCatalog((previous) => ({ ...previous, friends, error: "" }));
      } catch {
        if (active)
          setCatalog((previous) => ({
            ...previous,
            error:
              "Community data couldn’t refresh. Showing the available restaurant catalog.",
          }));
      } finally {
        loading = false;
      }
    }
    void refresh();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return (
    <Backend.Provider
      value={{
        ...catalog,
        mapPlaces,
        mapCount,
        mapNeedsZoom,
        mapLoading,
        mapLoadError,
        retryMapRestaurants,
        loadMapViewport,
        loadFavoritesPage,
        loadPlacesByIds,
      }}
    >
      {children}
    </Backend.Provider>
  );
}
