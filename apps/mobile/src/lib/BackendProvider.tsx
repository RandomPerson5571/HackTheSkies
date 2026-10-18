import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  places as bundledPlaces,
  type Place,
} from "../features/restaurants/data/places";
import torontoRestaurantSample from "../features/restaurants/data/importedRestaurants.json" with { type: "json" };
import {
  sampleFriends,
  type SampleFriend,
} from "../features/community/models/community";
import { supabase } from "./supabase";
import { apiEndpoint } from "./api";

const mapCacheTtlMs = 10 * 60 * 1000;
const offlinePlaces: Place[] = [
  ...bundledPlaces,
  ...torontoRestaurantSample.map((restaurant): Place => ({
    id: restaurant.id,
    name: restaurant.restaurant_name,
    category: "Restaurant",
    cuisine: restaurant.cuisine,
    neighborhood: restaurant.neighbourhood,
    address: restaurant.address,
    coordinate: [restaurant.coordinate[0]!, restaurant.coordinate[1]!],
    image: "",
    note: restaurant.category,
    sourceUrl: restaurant.source_url,
    rating: restaurant.rating,
  })),
];

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
    loadMapViewport: async () => {},
    loadFavoritesPage: async () => ({ places: [], total: 0 }),
    loadPlacesByIds: async () => [],
    friends: sampleFriends,
    error: "",
  });
  const mapRequest = useRef(0);
  const mapQueryKey = useRef("");
  const mapResponseCache = useRef(
    new Map<string, { expiresAt: number; count: number; places?: Place[] }>(),
  );
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
    try {
      if (!supabase) throw new Error("Missing Supabase configuration");
      const { data, error } = await supabase
        .from("cibo_restaurants")
        .select("id,data")
        .in("id", ids);
      if (error) throw error;
      const byId = new Map(
        (data ?? []).flatMap((row) => {
          const place = row.data as Place;
          return place && Array.isArray(place.coordinate)
            ? [[row.id, place] as const]
            : [];
        }),
      );
      return ids.flatMap((id) => {
        const place = byId.get(id);
        return place ? [place] : [];
      });
    } catch {
      const byId = new Map(bundledPlaces.map((place) => [place.id, place]));
      return ids.flatMap((id) => {
        const place = byId.get(id);
        return place ? [place] : [];
      });
    }
  }, []);
  const loadMapViewport = useCallback(
    async (bounds: MapBounds, zoom: number) => {
      const [west, south, east, north] = bounds;
      const mode = zoom < 12 ? "count" : "details";
      const queryKey = `${mode}:${bounds.map((value) => value.toFixed(3)).join(",")}`;
      if (queryKey === mapQueryKey.current) return;
      mapQueryKey.current = queryKey;
      const request = ++mapRequest.current;
      setMapNeedsZoom(mode === "count");
      const inBounds = (place: Place) => {
        const [longitude, latitude] = place.coordinate;
        return (
          (west <= east
            ? longitude >= west && longitude <= east
            : longitude >= west || longitude <= east) &&
          latitude >= south &&
          latitude <= north
        );
      };
      const localPlaces = offlinePlaces.filter(inBounds);
      // Keep already loaded details and fill new areas immediately from the catalog.
      setMapPlaces((previous) =>
        mode === "count"
          ? localPlaces.slice(0, 400)
          : [
              ...new Map(
                [...localPlaces, ...previous.filter(inBounds)].map((place) => [
                  place.id,
                  place,
                ]),
              ).values(),
            ].slice(0, 400),
      );
      setMapCount(localPlaces.length);

      const cached = mapResponseCache.current.get(queryKey);
      if (cached && cached.expiresAt > Date.now()) {
        setMapCount(cached.count);
        if (mode === "details") setMapPlaces(cached.places ?? []);
        return;
      }
      if (cached) mapResponseCache.current.delete(queryKey);

      try {
        const endpoint = apiEndpoint("/api/restaurants");
        if (!endpoint) throw new Error("Missing restaurant search API configuration");
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bounds: { west, south, east, north }, mode }),
          signal: AbortSignal.timeout(30_000),
        });
        if (!response.ok) throw new Error("Restaurant search request failed");
        const payload = await response.json() as { places?: unknown; count?: unknown };
        const loaded = mode === "details" && Array.isArray(payload.places)
          ? payload.places.flatMap((value) => {
              if (!value || typeof value !== "object") return [];
              const place = value as Place;
              if (
                typeof place.id !== "string" ||
                typeof place.name !== "string" ||
                !Array.isArray(place.coordinate) ||
                !inBounds(place)
              ) return [];
              return [{ ...place, image: "", photo: undefined }];
            }).slice(0, 400)
          : [];
        if (request === mapRequest.current) {
          if (mode === "details") setMapPlaces(loaded);
          const responseCount = Number(payload.count);
          const count = Number.isFinite(responseCount) ? responseCount : loaded.length;
          setMapCount(count);
          while (mapResponseCache.current.size >= 128) {
            const oldest = mapResponseCache.current.keys().next().value;
            if (oldest === undefined) break;
            mapResponseCache.current.delete(oldest);
          }
          mapResponseCache.current.set(queryKey, {
            expiresAt: Date.now() + mapCacheTtlMs,
            count,
            ...(mode === "details" ? { places: loaded } : {}),
          });
        }
      } catch {
        // Allow a subsequent idle event to retry this viewport after a failure.
        // Keep the immediately available pins instead of blanking the map.
        if (request === mapRequest.current) mapQueryKey.current = "";
      }
    },
    [],
  );

  useEffect(
    () => () => {
      mapRequest.current += 1;
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
        loadMapViewport,
        loadFavoritesPage,
        loadPlacesByIds,
      }}
    >
      {children}
    </Backend.Provider>
  );
}
