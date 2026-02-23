import { describe, expect, it } from 'vitest';
import { FeasibilityService } from '../src/scoring/feasibility.service';

describe('FeasibilityService', () => {
  const service = new FeasibilityService();
  const input = {
    workflowId: 'wf-1',
    tenantId: 'tenant_day1',
    eventCount30d: 80,
    uniqueActorCount: 2,
    uniqueToolCount: 2,
    varianceRatio: 0.12,
    avgMinutesPerRun: 17,
    monthlyRuns: 40
  };

  it('accepts valid rationale matching strict JSON schema', () => {
    const result = service.score(input, {
      version: '1',
      summary: 'Pattern is stable and connector coverage is high.',
      blockers: ['Rate limits during spikes.'],
      assumptions: ['Read-only scopes remain available.'],
      confidence: 0.88
    });

    expect(result.rationale).toBeDefined();
    expect(result.feasibilityScore).toBeGreaterThan(0);
  });

  it('rejects invalid rationale with additional property', () => {
    expect(() =>
      service.score(input, {
        version: '1',
        summary: 'Invalid additional property',
        blockers: [],
        assumptions: [],
        confidence: 0.9,
        extra: true
      })
    ).toThrowError(/Invalid LLM rationale JSON/);
  });
});
