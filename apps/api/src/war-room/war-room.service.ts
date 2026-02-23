import { Injectable } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import { WarRoomOpportunity } from '@nexus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  WarRoomRecommendationFilter,
  WarRoomReviewStatusFilter,
  WarRoomSortField
} from './war-room.dto';

const recommendationWeight: Record<RecommendationStatus, number> = {
  RECOMMENDED: 3,
  NEEDS_REVIEW: 2,
  NOT_RECOMMENDED: 1
};

function compareWithDirection(
  left: number,
  right: number,
  direction: 'asc' | 'desc'
): number {
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
  sortBy: WarRoomSortField,
  sortDir: 'asc' | 'desc'
): number {
  if (sortBy === 'priority') {
    return compareWithDirection(
      recommendationWeight[left.recommendationStatus as RecommendationStatus],
      recommendationWeight[right.recommendationStatus as RecommendationStatus],
      sortDir
    );
  }

  if (sortBy === 'annualNetSavings') {
    return compareWithDirection(left.annualNetSavings, right.annualNetSavings, sortDir);
  }

  if (sortBy === 'roiScore') {
    return compareWithDirection(left.roiScore, right.roiScore, sortDir);
  }

  if (sortBy === 'feasibilityScore') {
    return compareWithDirection(left.feasibilityScore, right.feasibilityScore, sortDir);
  }

  if (sortBy === 'workflowConfidence') {
    return compareWithDirection(left.workflowConfidence, right.workflowConfidence, sortDir);
  }

  return compareWithDirection(left.annualLaborCost, right.annualLaborCost, sortDir);
}

@Injectable()
export class WarRoomService {
  constructor(private readonly prisma: PrismaService) {}

  async listOpportunities(input: {
    tenantId: string;
    includeNeedsReview: boolean;
    recommendationFilter: WarRoomRecommendationFilter;
    reviewStatusFilter: WarRoomReviewStatusFilter;
    sortBy: WarRoomSortField;
    sortDir: 'asc' | 'desc';
    limit: number;
  }): Promise<WarRoomOpportunity[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        tenantId: input.tenantId
      },
      include: {
        feasibility: true,
        roiSimulation: true,
        reviewItem: true
      }
    });

    const opportunities: WarRoomOpportunity[] = workflows
      .filter((workflow) => workflow.feasibility && workflow.roiSimulation && workflow.reviewItem)
      .map((workflow) => ({
        workflowId: workflow.id,
        workflowName: workflow.name,
        feasibilityScore: workflow.feasibility!.feasibilityScore,
        feasibilityConfidence: workflow.feasibility!.confidence,
        annualLaborCost: workflow.roiSimulation!.annualLaborCost,
        annualNetSavings: workflow.roiSimulation!.annualNetSavings,
        paybackMonths: workflow.roiSimulation!.paybackMonths,
        roiScore: workflow.roiSimulation!.roiScore,
        workflowConfidence: workflow.confidence,
        recommendationStatus: workflow.reviewItem!.recommendationStatus,
        reviewStatus: workflow.reviewItem!.reviewStatus
      }))
      .filter(
        (item) => input.includeNeedsReview || item.recommendationStatus !== 'NEEDS_REVIEW'
      )
      .filter((item) => {
        if (input.recommendationFilter === 'ALL') {
          return true;
        }
        return item.recommendationStatus === input.recommendationFilter;
      })
      .filter((item) => {
        if (input.reviewStatusFilter === 'ALL') {
          return true;
        }
        return item.reviewStatus === input.reviewStatusFilter;
      })
      .sort((a, b) => {
        const primarySort = comparePrimarySort(a, b, input.sortBy, input.sortDir);
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

        if (b.feasibilityConfidence !== a.feasibilityConfidence) {
          return b.feasibilityConfidence - a.feasibilityConfidence;
        }

        if (a.reviewStatus !== b.reviewStatus) {
          const left = a.reviewStatus === 'PENDING_REVIEW' ? 1 : 0;
          const right = b.reviewStatus === 'PENDING_REVIEW' ? 1 : 0;
          return right - left;
        }

        return a.workflowName.localeCompare(b.workflowName);
      });

    return opportunities.slice(0, input.limit);
  }
}
