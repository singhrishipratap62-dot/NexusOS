import { afterEach, describe, expect, it } from 'vitest';
import { FeasibilityService } from '../src/scoring/feasibility.service';
import { PipelineService } from '../src/pipeline/pipeline.service';
import { WarRoomService } from '../src/war-room/war-room.service';
import { InMemoryPrismaService } from './helpers/in-memory-prisma';

describe('smoke flow: ingest -> normalize -> workflow -> score -> dashboard', () => {
  const originalEnableLlmRationale = process.env.ENABLE_LLM_RATIONALE;

  afterEach(() => {
    process.env.ENABLE_LLM_RATIONALE = originalEnableLlmRationale;
  });

  it('runs seeded audit end-to-end and returns ranked war-room opportunities', async () => {
    process.env.ENABLE_LLM_RATIONALE = 'false';

    const prisma = new InMemoryPrismaService();
    const mockTriggerEvaluator = {
      evaluateNewEvents: async () => []
    };
    const pipeline = new PipelineService(prisma as never, new FeasibilityService(), mockTriggerEvaluator as never);
    const warRoom = new WarRoomService(prisma as never);

    const firstRun = await pipeline.runSeededAudit('tenant_day1');

    expect(firstRun.slack.ingested).toBeGreaterThan(0);
    expect(firstRun.gmail.ingested).toBeGreaterThan(0);
    expect(firstRun.slack.duplicates).toBe(0);
    expect(firstRun.gmail.duplicates).toBe(0);
    expect(firstRun.slack.normalized).toBeGreaterThan(0);
    expect(firstRun.gmail.normalized).toBeGreaterThan(0);
    expect(firstRun.workflows).toBeGreaterThan(0);

    const opportunities = await warRoom.listOpportunities({
      tenantId: 'tenant_day1',
      includeNeedsReview: true,
      recommendationFilter: 'ALL',
      reviewStatusFilter: 'ALL',
      sortBy: 'priority',
      sortDir: 'desc',
      limit: 25
    });

    expect(opportunities.length).toBeGreaterThan(0);
    expect(opportunities[0]).toMatchObject({
      workflowName: 'Customer Escalation Resolution',
      annualLaborCost: expect.any(Number),
      annualNetSavings: expect.any(Number),
      feasibilityScore: expect.any(Number),
      roiScore: expect.any(Number),
      workflowConfidence: expect.any(Number),
      recommendationStatus: expect.any(String),
      reviewStatus: expect.any(String)
    });

    const secondRun = await pipeline.runSeededAudit('tenant_day1');
    expect(secondRun.slack.ingested).toBe(0);
    expect(secondRun.gmail.ingested).toBe(0);
    expect(secondRun.slack.duplicates).toBeGreaterThan(0);
    expect(secondRun.gmail.duplicates).toBeGreaterThan(0);

    const opportunitiesAfterReplay = await warRoom.listOpportunities({
      tenantId: 'tenant_day1',
      includeNeedsReview: true,
      recommendationFilter: 'ALL',
      reviewStatusFilter: 'ALL',
      sortBy: 'priority',
      sortDir: 'desc',
      limit: 25
    });

    expect(opportunitiesAfterReplay).toEqual(opportunities);
  });
});
