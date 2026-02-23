import { describe, expect, it, vi } from 'vitest';
import { WarRoomService } from '../src/war-room/war-room.service';

function makeWorkflow(input: {
  id: string;
  name: string;
  confidence: number;
  feasibilityScore: number;
  feasibilityConfidence: number;
  annualLaborCost: number;
  annualNetSavings: number;
  paybackMonths: number | null;
  roiScore: number;
  recommendationStatus: 'RECOMMENDED' | 'NEEDS_REVIEW' | 'NOT_RECOMMENDED';
  reviewStatus: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
}) {
  return {
    id: input.id,
    name: input.name,
    confidence: input.confidence,
    feasibility: {
      feasibilityScore: input.feasibilityScore,
      confidence: input.feasibilityConfidence
    },
    roiSimulation: {
      annualLaborCost: input.annualLaborCost,
      annualNetSavings: input.annualNetSavings,
      paybackMonths: input.paybackMonths,
      roiScore: input.roiScore
    },
    reviewItem: {
      recommendationStatus: input.recommendationStatus,
      reviewStatus: input.reviewStatus
    }
  };
}

describe('WarRoomService.listOpportunities', () => {
  it('sorts by priority by default and excludes NEEDS_REVIEW when requested', async () => {
    const workflows = [
      makeWorkflow({
        id: 'wf-needs',
        name: 'Needs Review Flow',
        confidence: 0.62,
        feasibilityScore: 0.72,
        feasibilityConfidence: 0.66,
        annualLaborCost: 50000,
        annualNetSavings: 42000,
        paybackMonths: 7.2,
        roiScore: 0.82,
        recommendationStatus: 'NEEDS_REVIEW',
        reviewStatus: 'PENDING_REVIEW'
      }),
      makeWorkflow({
        id: 'wf-rec',
        name: 'Recommended Flow',
        confidence: 0.9,
        feasibilityScore: 0.8,
        feasibilityConfidence: 0.88,
        annualLaborCost: 28000,
        annualNetSavings: 22000,
        paybackMonths: 9.1,
        roiScore: 0.64,
        recommendationStatus: 'RECOMMENDED',
        reviewStatus: 'AUTO_APPROVED'
      }),
      makeWorkflow({
        id: 'wf-not',
        name: 'Not Recommended Flow',
        confidence: 0.86,
        feasibilityScore: 0.42,
        feasibilityConfidence: 0.85,
        annualLaborCost: 12000,
        annualNetSavings: -1500,
        paybackMonths: null,
        roiScore: 0.05,
        recommendationStatus: 'NOT_RECOMMENDED',
        reviewStatus: 'REJECTED'
      })
    ];

    const service = new WarRoomService({
      workflow: {
        findMany: vi.fn().mockResolvedValue(workflows)
      }
    } as never);

    const result = await service.listOpportunities({
      tenantId: 'tenant_day1',
      includeNeedsReview: false,
      recommendationFilter: 'ALL',
      reviewStatusFilter: 'ALL',
      sortBy: 'priority',
      sortDir: 'desc',
      limit: 25
    });

    expect(result.map((item) => item.workflowId)).toEqual(['wf-rec', 'wf-not']);
  });

  it('supports recommendation/review filters with custom sorting', async () => {
    const workflows = [
      makeWorkflow({
        id: 'wf-1',
        name: 'Pending Review One',
        confidence: 0.68,
        feasibilityScore: 0.61,
        feasibilityConfidence: 0.66,
        annualLaborCost: 18000,
        annualNetSavings: 9000,
        paybackMonths: 18,
        roiScore: 0.42,
        recommendationStatus: 'NEEDS_REVIEW',
        reviewStatus: 'PENDING_REVIEW'
      }),
      makeWorkflow({
        id: 'wf-2',
        name: 'Pending Review Two',
        confidence: 0.65,
        feasibilityScore: 0.74,
        feasibilityConfidence: 0.69,
        annualLaborCost: 24000,
        annualNetSavings: 12000,
        paybackMonths: 16,
        roiScore: 0.57,
        recommendationStatus: 'NEEDS_REVIEW',
        reviewStatus: 'PENDING_REVIEW'
      }),
      makeWorkflow({
        id: 'wf-3',
        name: 'Already Approved',
        confidence: 0.72,
        feasibilityScore: 0.7,
        feasibilityConfidence: 0.75,
        annualLaborCost: 20000,
        annualNetSavings: 15000,
        paybackMonths: 14,
        roiScore: 0.63,
        recommendationStatus: 'RECOMMENDED',
        reviewStatus: 'APPROVED'
      })
    ];

    const service = new WarRoomService({
      workflow: {
        findMany: vi.fn().mockResolvedValue(workflows)
      }
    } as never);

    const result = await service.listOpportunities({
      tenantId: 'tenant_day1',
      includeNeedsReview: true,
      recommendationFilter: 'NEEDS_REVIEW',
      reviewStatusFilter: 'PENDING_REVIEW',
      sortBy: 'roiScore',
      sortDir: 'desc',
      limit: 25
    });

    expect(result.map((item) => item.workflowId)).toEqual(['wf-2', 'wf-1']);
  });
});
