import { describe, expect, it } from 'vitest';
import { extractWorkflows, loadGmailAuditFixtures, loadSlackAuditFixtures } from '@nexus/shared';

describe('seeded smoke pipeline data shape', () => {
  it('extracts at least one stable workflow from combined fixture events', () => {
    const slack = loadSlackAuditFixtures();
    const gmail = loadGmailAuditFixtures();

    const normalized = [...slack, ...gmail].map((event) => ({
      tenantId: 'tenant_day1',
      provider: event.provider,
      externalId: event.externalId,
      actor: event.actor,
      tool: event.provider === 'SLACK' ? 'Slack' : 'Gmail',
      action: 'placeholder',
      occurredAt: event.occurredAt,
      payload: event.payload
    }));

    const workflows = extractWorkflows(normalized);

    expect(workflows.length).toBeGreaterThan(0);
    expect(workflows[0]?.confidence).toBeGreaterThan(0.6);
    expect(workflows[0]?.monthlyRuns).toBeGreaterThan(5);
  });
});
