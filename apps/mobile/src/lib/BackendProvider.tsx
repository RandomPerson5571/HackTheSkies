import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import {
  places as bundledPlaces,
  isValidCoordinate,
  type Place,
} from "../features/restaurants/data/places";
import {
  sampleFriends,
  type SampleFriend,
} from "../features/community/models/community";
import { supabase } from "./supabase";

type Catalog = { places: Place[]; friends: SampleFriend[]; error: string };
const Backend = createContext<Catalog>({
  places: bundledPlaces,
  friends: sampleFriends,
  error: "",
});
export function useBackend() {
  return useContext(Backend);
}

export function BackendProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>({
    places: bundledPlaces,
    friends: sampleFriends,
    error: "",
  });
  useEffect(() => {
    let active = true;
    let loading = false;
    async function refresh() {
      if (loading) return;
      loading = true;
      try {
        if (!supabase) throw new Error("Missing Supabase configuration");
        const [restaurants, ratings, reviewers, reviews] = await Promise.all([
          supabase
            .from("cibo_restaurants")
            .select("id,data")
            .order("id")
            .limit(1000),
          supabase.from("cibo_restaurant_ratings").select("*").limit(1000),
          supabase.from("cibo_reviewers").select("*").order("name"),
          supabase
            .from("cibo_reviews")
            .select("*")
            .order("visited_at", { ascending: false })
            .limit(120),
        ]);
        for (const result of [restaurants, ratings, reviewers, reviews])
          if (result.error) throw result.error;
        if (!restaurants.data?.length)
          throw new Error("Restaurant catalog is empty");
        const summaries = new Map(
          (ratings.data ?? []).map((row) => [
            row.restaurant_id,
            {
              averageRating: Number(row.average_rating),
              reviewCount: Number(row.review_count),
            },
          ]),
        );
        const places = restaurants.data
          .map((row) => ({
            ...(row.data as Place),
            ratingSummary: summaries.get(row.id),
          }))
          .filter((place) => isValidCoordinate(place.coordinate));
        const friends: SampleFriend[] = (reviewers.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          handle: row.handle,
          initials: row.initials,
          bio: row.bio,
          visits: (reviews.data ?? [])
            .filter((review) => review.reviewer_id === row.id)
            .map((review) => ({
              placeId: review.restaurant_id,
              rating: review.rating,
              note: review.note,
              when: new Date(review.visited_at).toLocaleDateString("en-CA"),
            })),
        }));
        if (active) setCatalog({ places, friends, error: "" });
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
  return <Backend.Provider value={catalog}>{children}</Backend.Provider>;
}
