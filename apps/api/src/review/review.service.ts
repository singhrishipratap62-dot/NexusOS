import { Injectable, NotFoundException } from '@nestjs/common';
import { RecommendationStatus, ReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  async listQueue(tenantId: string, includeResolved = false): Promise<unknown[]> {
    const items = await this.prisma.reviewQueue.findMany({
      where: {
        tenantId,
        ...(includeResolved
          ? {}
          : {
              reviewStatus: 'PENDING_REVIEW'
            })
      },
      include: {
        workflow: {
          include: {
            feasibility: true,
            roiSimulation: true
          }
        }
      },
      orderBy: [
        {
          createdAt: 'desc'
        }
      ]
    });

    return items.map((item) => ({
      workflowId: item.workflowId,
      workflowName: item.workflow.name,
      workflowConfidence: item.workflow.confidence,
      recommendationStatus: item.recommendationStatus,
      reviewStatus: item.reviewStatus,
      reason: item.reason,
      reviewedAt: item.reviewedAt?.toISOString() ?? null,
      feasibilityScore: item.workflow.feasibility?.feasibilityScore ?? null,
      roiScore: item.workflow.roiSimulation?.roiScore ?? null
    }));
  }

  async decide(input: {
    tenantId: string;
    workflowId: string;
    actorId: string;
    decision: 'APPROVE' | 'REJECT';
    reason: string;
  }): Promise<{
    workflowId: string;
    recommendationStatus: RecommendationStatus;
    reviewStatus: ReviewStatus;
  }> {
    const existing = await this.prisma.reviewQueue.findUnique({
      where: {
        workflowId: input.workflowId
      },
      include: {
        workflow: {
          select: {
            tenantId: true
          }
        }
      }
    });

    if (!existing || existing.workflow.tenantId !== input.tenantId) {
      throw new NotFoundException('Review queue item not found for tenant');
    }

    const recommendationStatus: RecommendationStatus =
      input.decision === 'APPROVE' ? 'RECOMMENDED' : 'NOT_RECOMMENDED';
    const reviewStatus: ReviewStatus = input.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';

    const updated = await this.prisma.reviewQueue.update({
      where: {
        workflowId: input.workflowId
      },
      data: {
        recommendationStatus,
        reviewStatus,
        reason: input.reason,
        reviewerId: input.actorId,
        reviewedAt: new Date()
      }
    });

    return {
      workflowId: updated.workflowId,
      recommendationStatus: updated.recommendationStatus,
      reviewStatus: updated.reviewStatus
    };
  }
}
