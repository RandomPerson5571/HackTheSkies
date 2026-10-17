import type { Place } from "../data/places";
import { sampleFriends } from "../../community/models/community.ts";

export const recommendationPolicy = {
  qualityWeight: 0.6,
  nicheWeight: 0.4,
  popularityCeiling: 10_000,
  minimumRating: 4,
  minimumScore: 75,
  maxPhotoPins: 8,
} as const;

export type Recommendation = {
  averageRating: number | null;
  reviewCount: number;
  score: number;
  suggested: boolean;
  sampleReviewCount: number;
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
  const sampleVotes = new Map<string, number[]>();
  for (const friend of sampleFriends) {
    for (const visit of friend.visits) {
      const votes = sampleVotes.get(visit.placeId) ?? [];
      votes.push(visit.rating);
      sampleVotes.set(visit.placeId, votes);
    }
  }
  return new Map(
    places.map((place) => {
      const aggregate = place.ratingSummary;
      const validAggregate =
        aggregate &&
        scoreRestaurant(aggregate.averageRating, aggregate.reviewCount) > 0;
      const samples = validAggregate ? [] : (sampleVotes.get(place.id) ?? []);
      let reviewCount = validAggregate ? aggregate.reviewCount : samples.length;
      let total = validAggregate
        ? aggregate.averageRating * reviewCount
        : samples.reduce((sum, vote) => sum + vote, 0);
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
          sampleReviewCount: samples.length,
        },
      ];
    }),
  );
}

export function recommendationLabel(
  rating: Recommendation | undefined,
): string {
  if (!rating || rating.averageRating === null) return "Not rated yet";
  return `${rating.suggested ? "Suggested · " : ""}${rating.averageRating.toFixed(1)}/5 · ${rating.reviewCount} ${rating.reviewCount === 1 ? "rating" : "ratings"} · Score ${Math.round(rating.score)}/100${rating.sampleReviewCount ? " · Includes sample ratings" : ""}`;
}

// Only unclustered points in the viewport receive photos; selection stays visible
// as a lightweight pin even when it is not eligible for a photo.
export function getMapMarkerPlaces(
  places: readonly Place[],
  visibleIds: ReadonlySet<string>,
  ratings: Recommendations,
  selectedId?: string,
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
  return (selected ? [selected, ...suggested] : suggested).slice(
    0,
    recommendationPolicy.maxPhotoPins,
  );
}
