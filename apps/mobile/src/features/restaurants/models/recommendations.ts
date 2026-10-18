import type { Place } from "../data/places";

export const recommendationPolicy = {
  qualityWeight: 0.6,
  nicheWeight: 0.4,
  popularityCeiling: 10_000,
  minimumRating: 4,
  minimumScore: 75,
  overviewPhotoPins: 8,
  maxPhotoPins: 32,
  photoPinZoomThreshold: 11,
  photoPinsPerZoomLevel: 4,
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
                (ratings.get(a.id)?.score ?? 0) ||
              a.id.localeCompare(b.id),
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
  return (selected ? [selected, ...suggested] : suggested).slice(
    0,
    pinLimit,
  ).concat(additional).slice(0, pinLimit);
}
