import { describe, expect, it } from 'vitest';
import {
  FEASIBILITY_SCORE_WEIGHTS,
  ROI_FORMULA_CONSTANTS,
  scoreFeasibility,
  scoreHlcRoi
} from '../src';

describe('scoring formulas', () => {
  it('produces bounded feasibility score', () => {
    const result = scoreFeasibility({
      workflowId: 'wf-1',
      tenantId: 'tenant_day1',
      eventCount30d: 55,
      uniqueActorCount: 3,
      uniqueToolCount: 2,
      varianceRatio: 0.2,
      avgMinutesPerRun: 15,
      monthlyRuns: 32
    });

    expect(FEASIBILITY_SCORE_WEIGHTS).toEqual({
      processStability: 0.32,
      integrationComplexity: 0.24,
      dataAvailability: 0.26,
      exceptionRisk: 0.18
    });
    expect(result.feasibilityScore).toBeGreaterThan(0);
    expect(result.feasibilityScore).toBeLessThanOrEqual(1);
    expect(result.feasibilityScore).toBe(0.8567);
    expect(result.confidence).toBe(1);
    expect(result.breakdown).toEqual({
      processStability: 0.8,
      integrationComplexity: 0.88,
      dataAvailability: 0.9167,
      exceptionRisk: 0.84
    });
  });

  it('calculates positive payback for positive savings', () => {
    const result = scoreHlcRoi({
      workflowId: 'wf-1',
      tenantId: 'tenant_day1',
      avgMinutesPerRun: 22,
      monthlyRuns: 48,
      blendedHourlyRate: 95,
      feasibilityScore: 0.78,
      implementationCost: 18000,
      annualPlatformCost: 4200
    });

    expect(ROI_FORMULA_CONSTANTS).toEqual({
      automationCoverageMultiplier: 0.85,
      roiScoreScale: 1.5
    });
    expect(result).toEqual({
      annualLaborCost: 20064,
      annualNetSavings: 9102.43,
      paybackMonths: 23.73,
      automationCoverage: 0.663,
      roiScore: 0.615
    });
  });

  it('returns null payback when annual net savings is non-positive', () => {
    const result = scoreHlcRoi({
      workflowId: 'wf-2',
      tenantId: 'tenant_day1',
      avgMinutesPerRun: 5,
      monthlyRuns: 5,
      blendedHourlyRate: 50,
      feasibilityScore: 0.2,
      implementationCost: 12000,
      annualPlatformCost: 10000
    });

    expect(result).toEqual({
      annualLaborCost: 250,
      annualNetSavings: -9957.5,
      paybackMonths: null,
      automationCoverage: 0.17,
      roiScore: 0
    });
  });
});
