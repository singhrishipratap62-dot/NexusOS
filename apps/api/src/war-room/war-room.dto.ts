import { IsIn, IsOptional, Matches } from 'class-validator';

export const WAR_ROOM_SORT_FIELDS = [
  'priority',
  'annualNetSavings',
  'roiScore',
  'feasibilityScore',
  'workflowConfidence',
  'annualLaborCost'
] as const;

export type WarRoomSortField = (typeof WAR_ROOM_SORT_FIELDS)[number];

export const WAR_ROOM_RECOMMENDATION_FILTERS = [
  'ALL',
  'RECOMMENDED',
  'NEEDS_REVIEW',
  'NOT_RECOMMENDED'
] as const;

export type WarRoomRecommendationFilter = (typeof WAR_ROOM_RECOMMENDATION_FILTERS)[number];

export const WAR_ROOM_REVIEW_STATUS_FILTERS = [
  'ALL',
  'PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
  'AUTO_APPROVED'
] as const;

export type WarRoomReviewStatusFilter = (typeof WAR_ROOM_REVIEW_STATUS_FILTERS)[number];

export class WarRoomQueryDto {
  @IsOptional()
  @IsIn(['true', 'false'])
  includeNeedsReview?: 'true' | 'false';

  @IsOptional()
  @Matches(/^\d+$/)
  limit?: string;

  @IsOptional()
  @IsIn(WAR_ROOM_SORT_FIELDS as unknown as string[])
  sortBy?: WarRoomSortField;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsIn(WAR_ROOM_RECOMMENDATION_FILTERS as unknown as string[])
  recommendation?: WarRoomRecommendationFilter;

  @IsOptional()
  @IsIn(WAR_ROOM_REVIEW_STATUS_FILTERS as unknown as string[])
  reviewStatus?: WarRoomReviewStatusFilter;
}
