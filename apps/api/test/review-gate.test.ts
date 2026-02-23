import { describe, expect, it } from 'vitest';
import { deriveRecommendationStatus } from '@nexus/shared';

describe('review gate threshold', () => {
  it('routes low-confidence opportunities to NEEDS_REVIEW', () => {
    const status = deriveRecommendationStatus({
      workflowConfidence: 0.66,
      feasibilityConfidence: 0.95,
      feasibilityScore: 0.9,
      annualNetSavings: 12000
    });

    expect(status).toBe('NEEDS_REVIEW');
  });

  it('never returns RECOMMENDED when minimum confidence is below 0.70', () => {
    const testCases = [
      { workflowConfidence: 0.69, feasibilityConfidence: 0.99 },
      { workflowConfidence: 0.99, feasibilityConfidence: 0.69 },
      { workflowConfidence: 0.1, feasibilityConfidence: 0.95 },
      { workflowConfidence: 0.95, feasibilityConfidence: 0.1 }
    ];

    for (const testCase of testCases) {
      const status = deriveRecommendationStatus({
        workflowConfidence: testCase.workflowConfidence,
        feasibilityConfidence: testCase.feasibilityConfidence,
        feasibilityScore: 0.95,
        annualNetSavings: 120000
      });

      expect(status).toBe('NEEDS_REVIEW');
    }
  });

  it('recommends high-confidence positive-savings opportunities', () => {
    const status = deriveRecommendationStatus({
      workflowConfidence: 0.89,
      feasibilityConfidence: 0.9,
      feasibilityScore: 0.72,
      annualNetSavings: 34000
    });

    expect(status).toBe('RECOMMENDED');
  });
});
