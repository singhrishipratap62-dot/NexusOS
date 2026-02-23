import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  extractWorkflows,
  loadGmailAuditFixtures,
  loadSlackAuditFixtures,
  normalizeRawConnectorEvent
} from '../src';

function normalizedFixtureEvents() {
  const raw = [...loadSlackAuditFixtures(), ...loadGmailAuditFixtures()];

  return raw.map((event) => {
    const normalized = normalizeRawConnectorEvent({
      provider: event.provider,
      externalId: event.externalId,
      payload: event.payload
    });

    return {
      tenantId: 'tenant_day1',
      provider: event.provider,
      externalId: event.externalId,
      actor: normalized.actor,
      tool: normalized.tool,
      action: normalized.action,
      channel: normalized.channel ?? undefined,
      occurredAt: event.occurredAt,
      payload: normalized.payload
    };
  });
}

describe('workflow DAG extraction (deterministic v1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('builds recurring workflow clusters with stable nodes and edges', () => {
    const events = normalizedFixtureEvents();

    const extractedA = extractWorkflows(events);
    const extractedB = extractWorkflows([...events].reverse());

    expect(extractedB).toEqual(extractedA);
    expect(extractedA).toHaveLength(1);

    const workflow = extractedA[0];
    expect(workflow).toMatchObject({
      workflowKey: 'customer-escalation-resolution',
      workflowName: 'Customer Escalation Resolution',
      monthlyRuns: 18,
      avgMinutesPerRun: 36
    });
    expect(workflow.confidence).toBeGreaterThan(0.9);

    expect(
      workflow.nodes.map((node) => ({
        sequence: node.sequence,
        actor: node.actor,
        tool: node.tool,
        action: node.action
      }))
    ).toEqual([
      {
        sequence: 1,
        actor: 'customer',
        tool: 'Gmail',
        action: 'intake_customer_request'
      },
      {
        sequence: 2,
        actor: 'support-lead',
        tool: 'Slack',
        action: 'triage_request'
      },
      {
        sequence: 3,
        actor: 'support-agent',
        tool: 'Gmail',
        action: 'respond_to_customer'
      },
      {
        sequence: 4,
        actor: 'support-lead',
        tool: 'Slack',
        action: 'publish_internal_update'
      }
    ]);
    expect(workflow.nodes.every((node) => node.confidence >= 0.85)).toBe(true);

    expect(workflow.edges).toEqual([
      { fromSequence: 1, toSequence: 2, confidence: 1 },
      { fromSequence: 2, toSequence: 3, confidence: 1 },
      { fromSequence: 3, toSequence: 4, confidence: 1 }
    ]);
  });

  it('skips non-recurring workflow clusters', () => {
    const events = [
      {
        tenantId: 'tenant_day1',
        provider: 'SLACK' as const,
        externalId: 'single-1',
        actor: 'support-lead',
        tool: 'Slack',
        action: 'triage_request',
        occurredAt: '2026-02-20T12:00:00.000Z',
        payload: {
          workflowHint: 'one-off-process',
          runKey: 'run-1',
          sequence: 1,
          minutesSpent: 5
        }
      }
    ];

    const extracted = extractWorkflows(events);
    expect(extracted).toEqual([]);
  });
});
