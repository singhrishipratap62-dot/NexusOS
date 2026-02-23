import { afterEach, describe, expect, it, vi } from 'vitest';
import { PipelineService } from '../src/pipeline/pipeline.service';
import { FeasibilityService } from '../src/scoring/feasibility.service';
import { scoreHlcRoi } from '@nexus/shared';

function buildRecurringNormalizedEvents() {
  return [
    {
      id: 'n1',
      provider: 'GMAIL',
      externalId: 'gmail-inbound-r1',
      actor: 'customer',
      tool: 'Gmail',
      action: 'intake_customer_request',
      channel: null,
      occurredAt: new Date('2026-02-20T10:00:00.000Z'),
      payload: {
        workflowHint: 'customer-escalation-resolution',
        runKey: 'run-1',
        sequence: 1,
        minutesSpent: 7
      },
      malformed: false
    },
    {
      id: 'n2',
      provider: 'SLACK',
      externalId: 'slack-triage-r1',
      actor: 'support-lead',
      tool: 'Slack',
      action: 'triage_request',
      channel: '#support-triage',
      occurredAt: new Date('2026-02-20T10:10:00.000Z'),
      payload: {
        workflowHint: 'customer-escalation-resolution',
        runKey: 'run-1',
        sequence: 2,
        minutesSpent: 5
      },
      malformed: false
    },
    {
      id: 'n3',
      provider: 'GMAIL',
      externalId: 'gmail-inbound-r2',
      actor: 'customer',
      tool: 'Gmail',
      action: 'intake_customer_request',
      channel: null,
      occurredAt: new Date('2026-02-21T10:00:00.000Z'),
      payload: {
        workflowHint: 'customer-escalation-resolution',
        runKey: 'run-2',
        sequence: 1,
        minutesSpent: 8
      },
      malformed: false
    },
    {
      id: 'n4',
      provider: 'SLACK',
      externalId: 'slack-triage-r2',
      actor: 'support-lead',
      tool: 'Slack',
      action: 'triage_request',
      channel: '#support-triage',
      occurredAt: new Date('2026-02-21T10:10:00.000Z'),
      payload: {
        workflowHint: 'customer-escalation-resolution',
        runKey: 'run-2',
        sequence: 2,
        minutesSpent: 6
      },
      malformed: false
    }
  ];
}

function createPrismaMock() {
  const workflowNodeCreate = vi
    .fn()
    .mockImplementation(async (args: { data: { sequence: number } }) => ({
      id: `node-${args.data.sequence}`
    }));

  return {
    normalizedEvent: {
      findMany: vi.fn().mockResolvedValue(buildRecurringNormalizedEvents())
    },
    workflow: {
      upsert: vi.fn().mockResolvedValue({ id: 'workflow-1' })
    },
    workflowNode: {
      deleteMany: vi.fn().mockResolvedValue(undefined),
      create: workflowNodeCreate
    },
    workflowEdge: {
      deleteMany: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue(undefined)
    },
    feasibilityScore: {
      upsert: vi.fn().mockResolvedValue(undefined)
    },
    hlcEstimate: {
      upsert: vi.fn().mockResolvedValue(undefined)
    },
    roiSimulation: {
      upsert: vi.fn().mockResolvedValue(undefined)
    },
    reviewQueue: {
      upsert: vi.fn().mockResolvedValue(undefined)
    }
  };
}

describe('PipelineService feasibility scoring persistence', () => {
  const originalEnableLlmRationale = process.env.ENABLE_LLM_RATIONALE;

  afterEach(() => {
    process.env.ENABLE_LLM_RATIONALE = originalEnableLlmRationale;
    vi.restoreAllMocks();
  });

  it('persists deterministic feasibility score and confidence', async () => {
    process.env.ENABLE_LLM_RATIONALE = 'false';

    const prismaMock = createPrismaMock();
    const service = new PipelineService(prismaMock as never, new FeasibilityService());

    const result = await service.extractAndScore('tenant_day1');

    expect(result.workflows).toBe(1);
    expect(prismaMock.feasibilityScore.upsert).toHaveBeenCalledTimes(1);

    const feasibilityPayload = prismaMock.feasibilityScore.upsert.mock.calls[0]?.[0];
    expect(feasibilityPayload.update.feasibilityScore).toBeGreaterThan(0);
    expect(feasibilityPayload.update.feasibilityScore).toBeLessThanOrEqual(1);
    expect(feasibilityPayload.update.confidence).toBeGreaterThan(0);
    expect(feasibilityPayload.update.confidence).toBeLessThanOrEqual(1);
    expect(feasibilityPayload.update.breakdown).toEqual({
      processStability: expect.any(Number),
      integrationComplexity: expect.any(Number),
      dataAvailability: expect.any(Number),
      exceptionRisk: expect.any(Number)
    });

    expect(prismaMock.reviewQueue.upsert).toHaveBeenCalledTimes(1);
    const reviewPayload = prismaMock.reviewQueue.upsert.mock.calls[0]?.[0];
    expect(reviewPayload.update).toMatchObject({
      recommendationStatus: 'NEEDS_REVIEW',
      reviewStatus: 'PENDING_REVIEW'
    });
    expect(reviewPayload.create).toMatchObject({
      recommendationStatus: 'NEEDS_REVIEW',
      reviewStatus: 'PENDING_REVIEW'
    });
  });

  it('fails closed when optional LLM rationale is invalid', async () => {
    process.env.ENABLE_LLM_RATIONALE = 'true';

    const feasibilityService = new FeasibilityService();
    vi.spyOn(feasibilityService, 'buildRationaleStub').mockReturnValue({
      version: '1',
      summary: 'Invalid rationale payload',
      blockers: [],
      assumptions: [],
      confidence: 0.9,
      extra: true
    } as never);

    const prismaMock = createPrismaMock();
    const service = new PipelineService(prismaMock as never, feasibilityService);

    await expect(service.extractAndScore('tenant_day1')).rejects.toThrowError(
      /Invalid LLM rationale JSON/
    );

    expect(prismaMock.feasibilityScore.upsert).not.toHaveBeenCalled();
  });

  it('persists HLC and ROI outputs from deterministic formulas', async () => {
    process.env.ENABLE_LLM_RATIONALE = 'false';
    process.env.BLENDED_HOURLY_RATE = '95';
    process.env.IMPLEMENTATION_COST_DEFAULT = '18000';
    process.env.ANNUAL_PLATFORM_COST = '4800';

    const prismaMock = createPrismaMock();
    const service = new PipelineService(prismaMock as never, new FeasibilityService());

    await service.extractAndScore('tenant_day1');

    expect(prismaMock.workflow.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.feasibilityScore.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.hlcEstimate.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.roiSimulation.upsert).toHaveBeenCalledTimes(1);

    const workflowPayload = prismaMock.workflow.upsert.mock.calls[0]?.[0];
    const feasibilityPayload = prismaMock.feasibilityScore.upsert.mock.calls[0]?.[0];
    const hlcPayload = prismaMock.hlcEstimate.upsert.mock.calls[0]?.[0];
    const roiPayload = prismaMock.roiSimulation.upsert.mock.calls[0]?.[0];

    const expectedRoi = scoreHlcRoi({
      workflowId: workflowPayload.create.workflowKey,
      tenantId: 'tenant_day1',
      avgMinutesPerRun: workflowPayload.create.avgMinutesPerRun,
      monthlyRuns: workflowPayload.create.monthlyRuns,
      blendedHourlyRate: 95,
      feasibilityScore: feasibilityPayload.create.feasibilityScore,
      implementationCost: 18000,
      annualPlatformCost: 4800
    });

    expect(hlcPayload.update.annualLaborCost).toBe(expectedRoi.annualLaborCost);
    expect(roiPayload.update).toMatchObject({
      annualLaborCost: expectedRoi.annualLaborCost,
      annualNetSavings: expectedRoi.annualNetSavings,
      paybackMonths: expectedRoi.paybackMonths,
      automationCoverage: expectedRoi.automationCoverage,
      roiScore: expectedRoi.roiScore
    });
  });
});
