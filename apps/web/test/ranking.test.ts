import { describe, expect, it } from 'vitest';
import { filterOpportunities, sortOpportunities } from '../components/ranking';

const sampleOpportunities = [
  {
    workflowId: '2',
    workflowName: 'needs review',
    feasibilityScore: 0.6,
    feasibilityConfidence: 0.61,
    annualLaborCost: 10000,
    annualNetSavings: 45000,
    paybackMonths: 4,
    roiScore: 0.9,
    workflowConfidence: 0.61,
    monthlyRuns: 50,
    avgMinutesPerRun: 15,
    recommendationStatus: 'NEEDS_REVIEW' as const,
    reviewStatus: 'PENDING_REVIEW' as const
  },
  {
    workflowId: '1',
    workflowName: 'recommended',
    feasibilityScore: 0.65,
    feasibilityConfidence: 0.86,
    annualLaborCost: 9000,
    annualNetSavings: 20000,
    paybackMonths: 5,
    roiScore: 0.8,
    workflowConfidence: 0.88,
    monthlyRuns: 30,
    avgMinutesPerRun: 10,
    recommendationStatus: 'RECOMMENDED' as const,
    reviewStatus: 'AUTO_APPROVED' as const
  },
  {
    workflowId: '3',
    workflowName: 'not recommended',
    feasibilityScore: 0.52,
    feasibilityConfidence: 0.84,
    annualLaborCost: 30000,
    annualNetSavings: -2000,
    paybackMonths: null,
    roiScore: 0.1,
    workflowConfidence: 0.9,
    monthlyRuns: 10,
    avgMinutesPerRun: 60,
    recommendationStatus: 'NOT_RECOMMENDED' as const,
    reviewStatus: 'REJECTED' as const
  }
];

describe('sortOpportunities', () => {
  it('keeps RECOMMENDED above NEEDS_REVIEW even if savings are lower', () => {
    const output = sortOpportunities(sampleOpportunities);

    expect(output[0]?.workflowId).toBe('1');
  });

  it('supports explicit sorting by annual net savings ascending', () => {
    const output = sortOpportunities(sampleOpportunities, {
      sortBy: 'annualNetSavings',
      sortDirection: 'asc'
    });

    expect(output.map((item) => item.workflowId)).toEqual(['3', '1', '2']);
  });
});

describe('filterOpportunities', () => {
  it('filters by recommendation and review status', () => {
    const output = filterOpportunities(sampleOpportunities, {
      recommendationFilter: 'NEEDS_REVIEW',
      reviewStatusFilter: 'PENDING_REVIEW'
    });

    expect(output).toHaveLength(1);
    expect(output[0]?.workflowId).toBe('2');
  });

  it('can exclude NEEDS_REVIEW rows for recommended-only view', () => {
    const output = filterOpportunities(sampleOpportunities, {
      includeNeedsReview: false
    });

    expect(output.map((item) => item.workflowId)).toEqual(['1', '3']);
  });
});
