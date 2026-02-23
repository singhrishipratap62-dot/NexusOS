import {
  FeasibilityInput,
  FeasibilityResult,
  HlcRoiInput,
  HlcRoiResult,
  RecommendationStatus,
  REVIEW_THRESHOLD
} from '@nexus/contracts';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const round2 = (value: number): number => Math.round(value * 100) / 100;

const round4 = (value: number): number => Math.round(value * 10000) / 10000;

export const FEASIBILITY_SCORE_WEIGHTS = {
  processStability: 0.32,
  integrationComplexity: 0.24,
  dataAvailability: 0.26,
  exceptionRisk: 0.18
} as const;

export const ROI_FORMULA_CONSTANTS = {
  automationCoverageMultiplier: 0.85,
  roiScoreScale: 1.5
} as const;

export function scoreFeasibility(input: FeasibilityInput): FeasibilityResult {
  const processStability = clamp01(1 - input.varianceRatio);
  const integrationComplexity = clamp01(1 - (input.uniqueToolCount - 1) * 0.12);
  const dataAvailability = clamp01(Math.min(1, input.eventCount30d / 60));
  const exceptionRisk = clamp01(1 - (input.uniqueActorCount - 1) * 0.08);

  const feasibilityScore = round4(
    processStability * FEASIBILITY_SCORE_WEIGHTS.processStability +
      integrationComplexity * FEASIBILITY_SCORE_WEIGHTS.integrationComplexity +
      dataAvailability * FEASIBILITY_SCORE_WEIGHTS.dataAvailability +
      exceptionRisk * FEASIBILITY_SCORE_WEIGHTS.exceptionRisk
  );

  const evidenceConfidence = clamp01(
    0.4 + Math.min(0.4, input.eventCount30d / 120) + Math.min(0.2, input.monthlyRuns / 120)
  );

  return {
    feasibilityScore,
    confidence: round4(evidenceConfidence),
    breakdown: {
      processStability: round4(processStability),
      integrationComplexity: round4(integrationComplexity),
      dataAvailability: round4(dataAvailability),
      exceptionRisk: round4(exceptionRisk)
    }
  };
}

export function scoreHlcRoi(input: HlcRoiInput): HlcRoiResult {
  const annualLaborCost = (input.avgMinutesPerRun / 60) * input.monthlyRuns * 12 * input.blendedHourlyRate;
  const automationCoverage = clamp01(
    input.feasibilityScore * ROI_FORMULA_CONSTANTS.automationCoverageMultiplier
  );
  const annualGrossSavings = annualLaborCost * automationCoverage;
  const annualNetSavings = annualGrossSavings - input.annualPlatformCost;

  const paybackMonths =
    annualNetSavings <= 0 ? null : round2(input.implementationCost / (annualNetSavings / 12));

  const roiScore = round4(
    clamp01(
      (Math.max(0, annualNetSavings) / Math.max(1, input.implementationCost + input.annualPlatformCost)) *
        ROI_FORMULA_CONSTANTS.roiScoreScale
    )
  );

  return {
    annualLaborCost: round2(annualLaborCost),
    annualNetSavings: round2(annualNetSavings),
    paybackMonths,
    automationCoverage: round4(automationCoverage),
    roiScore
  };
}

export function deriveRecommendationStatus(input: {
  workflowConfidence: number;
  feasibilityConfidence: number;
  feasibilityScore: number;
  annualNetSavings: number;
}): RecommendationStatus {
  const confidence = Math.min(input.workflowConfidence, input.feasibilityConfidence);

  if (confidence < REVIEW_THRESHOLD) {
    return 'NEEDS_REVIEW';
  }

  if (input.feasibilityScore >= 0.55 && input.annualNetSavings > 0) {
    return 'RECOMMENDED';
  }

  return 'NOT_RECOMMENDED';
}
