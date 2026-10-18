import type { Place } from "../data/places";

export const recommendationPolicy = {
  qualityWeight: 0.6,
  nicheWeight: 0.4,
  popularityCeiling: 10_000,
  minimumRating: 4,
  minimumScore: 75,
  overviewPhotoPins: 16,
  maxPhotoPins: 48,
  photoPinZoomThreshold: 9,
  photoPinsPerZoomLevel: 6,
} as const;

export type Recommendation = {
  averageRating: number | null;
  reviewCount: number;
  score: number;
  suggested: boolean;
};
export type Recommendations = ReadonlyMap<string, Recommendation>;

export function scoreRestaurant(
  averageRating: number,
  reviewCount: number,
): number {
  if (
    !Number.isFinite(averageRating) ||
    averageRating < 1 ||
    averageRating > 5 ||
    !Number.isSafeInteger(reviewCount) ||
    reviewCount <= 0
  )
    return 0;
  const quality = averageRating / 5;
  // Review count is a proxy for familiarity. Log scaling keeps one extra review
  // from dramatically changing a small restaurant's ranking.
  const niche =
    1 -
    Math.min(
      1,
      Math.log1p(reviewCount) /
        Math.log1p(recommendationPolicy.popularityCeiling),
    );
  return (
    100 *
    (quality * recommendationPolicy.qualityWeight +
      niche * recommendationPolicy.nicheWeight)
  );
}

export const rarityPolicy = {
  ratingWeight: 0.6,
  nicheWeight: 0.4,
  // Fewer public ratings than this are too thin to trust; the venue is
  // scored as estimated instead of as the rarest spot in the city.
  minimumRatings: 10,
  // Toronto listings range from about 80 to 2,000 public ratings. At or below
  // the floor a venue is fully niche; at or above the ceiling, fully mainstream.
  nicheFloor: 50,
  popularityCeiling: 2_000,
} as const;
export const rarityFilterOptions = [2.5, 3, 3.5, 4] as const;

export type Rarity = { value: number; estimated: boolean };

// Rarity out of 5 from public ratings: 60% the rating, 40% how few people have
// rated the venue, so well-loved local spots outrank famous ones.
export function rarityScore(
  averageRating: number,
  ratingCount: number,
): number | null {
  if (
    !Number.isFinite(averageRating) ||
    averageRating < 1 ||
    averageRating > 5 ||
    !Number.isSafeInteger(ratingCount) ||
    ratingCount <= 0
  )
    return null;
  const { nicheFloor, popularityCeiling } = rarityPolicy;
  const niche =
    1 -
    Math.min(
      1,
      Math.max(
        0,
        Math.log(ratingCount / nicheFloor) /
          Math.log(popularityCeiling / nicheFloor),
      ),
    );
  const value =
    5 *
    ((averageRating / 5) * rarityPolicy.ratingWeight +
      niche * rarityPolicy.nicheWeight);
  return Math.round(value * 10) / 10;
}

export function rarityLabel(rarity: Rarity | undefined): string {
  if (!rarity) return "Rarity unknown";
  return `Rarity ${rarity.value.toFixed(1)}/5${rarity.estimated ? " (estimated)" : ""}`;
}

export function buildRecommendations(
  places: readonly Place[],
  personalRatings: Readonly<Record<string, number>>,
): Recommendations {
  return new Map(
    places.map((place) => {
      const aggregate = place.ratingSummary;
      const validAggregate =
        aggregate &&
        scoreRestaurant(aggregate.averageRating, aggregate.reviewCount) > 0;
      let reviewCount = validAggregate ? aggregate.reviewCount : 0;
      let total = validAggregate ? aggregate.averageRating * reviewCount : 0;
      const personal = personalRatings[place.id];
      if (
        typeof personal === "number" &&
        Number.isInteger(personal) &&
        personal >= 1 &&
        personal <= 5
      ) {
        total += personal;
        reviewCount += 1;
      }
      const averageRating = reviewCount ? total / reviewCount : null;
      const score =
        averageRating === null
          ? 0
          : scoreRestaurant(averageRating, reviewCount);
      return [
        place.id,
        {
          averageRating,
          reviewCount,
          score,
          suggested:
            averageRating !== null &&
            averageRating >= recommendationPolicy.minimumRating &&
            score >= recommendationPolicy.minimumScore,
        },
      ];
    }),
  );
}

export function recommendationLabel(
  rating: Recommendation | undefined,
): string {
  if (!rating || rating.averageRating === null) return "Not rated yet";
  return `${rating.averageRating.toFixed(1)}/5 · ${rating.reviewCount} ${rating.reviewCount === 1 ? "rating" : "ratings"}`;
}

export function recommendationBadge(
  rating: Recommendation | undefined,
): string {
  if (!rating || rating.averageRating === null) return "Not rated yet";
  if (rating.suggested) {
    if (rating.reviewCount <= 25) return "Hidden gem";
    if (rating.averageRating >= 4.5) return "Highly rated";
    return "Worth exploring";
  }
  if (rating.averageRating >= 4.5) return "Highly rated";
  return "Worth exploring";
}

// Only unclustered points in the viewport receive photos; selection stays visible
// as a lightweight pin even when it is not eligible for a photo.
export function getMapMarkerPlaces(
  places: readonly Place[],
  visibleIds: ReadonlySet<string>,
  ratings: Recommendations,
  selectedId?: string,
  zoom = 10.5,
): Place[] {
  const selected = places.find((place) => place.id === selectedId);
  const suggested = places
    .filter(
      (place) =>
        place.id !== selectedId &&
        visibleIds.has(place.id) &&
        ratings.get(place.id)?.suggested,
    )
    .sort(
      (a, b) =>
        (ratings.get(b.id)?.score ?? 0) - (ratings.get(a.id)?.score ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const suggestedIds = new Set(suggested.map((place) => place.id));
  const additional =
    zoom >= recommendationPolicy.photoPinZoomThreshold
      ? places
          .filter(
            (place) =>
              place.id !== selectedId &&
              visibleIds.has(place.id) &&
              !suggestedIds.has(place.id),
          )
          .sort(
            (a, b) =>
              (ratings.get(b.id)?.score ?? 0) -
                (ratings.get(a.id)?.score ?? 0) || a.id.localeCompare(b.id),
          )
      : [];
  const zoomLevels = Math.floor(
    Math.max(0, zoom - recommendationPolicy.photoPinZoomThreshold + 1),
  );
  const pinLimit = Math.min(
    recommendationPolicy.maxPhotoPins,
    recommendationPolicy.overviewPhotoPins +
      zoomLevels * recommendationPolicy.photoPinsPerZoomLevel,
  );
  return (selected ? [selected, ...suggested] : suggested)
    .slice(0, pinLimit)
    .concat(additional)
    .slice(0, pinLimit);
}
