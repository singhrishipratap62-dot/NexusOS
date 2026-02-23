import { WarRoomOpportunity } from '@nexus/contracts';

const statusWeight: Record<WarRoomOpportunity['recommendationStatus'], number> = {
  RECOMMENDED: 3,
  NEEDS_REVIEW: 2,
  NOT_RECOMMENDED: 1
};

export type WarRoomRecommendationFilter = 'ALL' | WarRoomOpportunity['recommendationStatus'];
export type WarRoomReviewStatusFilter = 'ALL' | WarRoomOpportunity['reviewStatus'];
export type WarRoomSortBy =
  | 'priority'
  | 'annualNetSavings'
  | 'roiScore'
  | 'feasibilityScore'
  | 'workflowConfidence'
  | 'annualLaborCost';
export type WarRoomSortDirection = 'asc' | 'desc';

export function filterOpportunities(
  items: WarRoomOpportunity[],
  options: {
    includeNeedsReview?: boolean;
    recommendationFilter?: WarRoomRecommendationFilter;
    reviewStatusFilter?: WarRoomReviewStatusFilter;
  }
): WarRoomOpportunity[] {
  const includeNeedsReview = options.includeNeedsReview ?? true;
  const recommendationFilter = options.recommendationFilter ?? 'ALL';
  const reviewStatusFilter = options.reviewStatusFilter ?? 'ALL';

  return items
    .filter((item) => includeNeedsReview || item.recommendationStatus !== 'NEEDS_REVIEW')
    .filter((item) =>
      recommendationFilter === 'ALL' ? true : item.recommendationStatus === recommendationFilter
    )
    .filter((item) => (reviewStatusFilter === 'ALL' ? true : item.reviewStatus === reviewStatusFilter));
}

function compareWithDirection(left: number, right: number, direction: WarRoomSortDirection): number {
  if (left === right) {
    return 0;
  }

  if (direction === 'asc') {
    return left < right ? -1 : 1;
  }

  return left > right ? -1 : 1;
}

function comparePrimarySort(
  left: WarRoomOpportunity,
  right: WarRoomOpportunity,
  sortBy: WarRoomSortBy,
  sortDirection: WarRoomSortDirection
): number {
  if (sortBy === 'priority') {
    return compareWithDirection(
      statusWeight[left.recommendationStatus],
      statusWeight[right.recommendationStatus],
      sortDirection
    );
  }

  if (sortBy === 'annualNetSavings') {
    return compareWithDirection(left.annualNetSavings, right.annualNetSavings, sortDirection);
  }

  if (sortBy === 'roiScore') {
    return compareWithDirection(left.roiScore, right.roiScore, sortDirection);
  }

  if (sortBy === 'feasibilityScore') {
    return compareWithDirection(left.feasibilityScore, right.feasibilityScore, sortDirection);
  }

  if (sortBy === 'workflowConfidence') {
    return compareWithDirection(left.workflowConfidence, right.workflowConfidence, sortDirection);
  }

  return compareWithDirection(left.annualLaborCost, right.annualLaborCost, sortDirection);
}

export function sortOpportunities(
  items: WarRoomOpportunity[],
  options?: {
    sortBy?: WarRoomSortBy;
    sortDirection?: WarRoomSortDirection;
  }
): WarRoomOpportunity[] {
  const sortBy = options?.sortBy ?? 'priority';
  const sortDirection = options?.sortDirection ?? 'desc';

  return [...items].sort((a, b) => {
    const primarySort = comparePrimarySort(a, b, sortBy, sortDirection);
    if (primarySort !== 0) {
      return primarySort;
    }

    if (b.annualNetSavings !== a.annualNetSavings) {
      return b.annualNetSavings - a.annualNetSavings;
    }

    if (b.roiScore !== a.roiScore) {
      return b.roiScore - a.roiScore;
    }

    if (b.workflowConfidence !== a.workflowConfidence) {
      return b.workflowConfidence - a.workflowConfidence;
    }

    return a.workflowName.localeCompare(b.workflowName);
  });
}
