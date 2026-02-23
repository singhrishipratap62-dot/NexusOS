import { describe, expect, it } from 'vitest';
import { normalizeRawConnectorEvent } from '../src/normalization';

describe('normalizeRawConnectorEvent', () => {
  it('maps Slack payload into canonical normalized schema', () => {
    const normalized = normalizeRawConnectorEvent({
      provider: 'SLACK',
      externalId: 'C123:1700000.001',
      payload: {
        channel: '#support-triage',
        ts: '1700000.001',
        text: 'Investigate escalation',
        subtype: null,
        workflowHint: 'customer-escalation-resolution',
        sequence: 2,
        runKey: 'support-1',
        minutesSpent: '11'
      }
    });

    expect(normalized.malformed).toBe(false);
    expect(normalized.actor).toBe('support-lead');
    expect(normalized.tool).toBe('Slack');
    expect(normalized.action).toBe('triage_request');
    expect(normalized.channel).toBe('#support-triage');
    expect(normalized.payload).toMatchObject({
      workflowHint: 'customer-escalation-resolution',
      sequence: 2,
      runKey: 'support-1',
      minutesSpent: 11
    });
    expect((normalized.payload.source as Record<string, unknown>).provider).toBe('SLACK');
  });

  it('maps Gmail outbound payload into canonical normalized schema', () => {
    const normalized = normalizeRawConnectorEvent({
      provider: 'GMAIL',
      externalId: 'gmail-reply-1',
      payload: {
        threadId: 'thread-1',
        historyId: 'history-1',
        labelIds: ['SENT'],
        from: 'support@example.com',
        subject: 'Re: Escalation',
        snippet: 'Response sent',
        workflowHint: 'customer-escalation-resolution',
        sequence: '3',
        runKey: 'support-1',
        minutesSpent: 14
      }
    });

    expect(normalized.malformed).toBe(false);
    expect(normalized.actor).toBe('support-agent');
    expect(normalized.tool).toBe('Gmail');
    expect(normalized.action).toBe('respond_to_customer');
    expect(normalized.channel).toBeNull();
    expect(normalized.payload).toMatchObject({
      workflowHint: 'customer-escalation-resolution',
      sequence: 3,
      runKey: 'support-1',
      minutesSpent: 14
    });
    expect((normalized.payload.source as Record<string, unknown>).provider).toBe('GMAIL');
  });

  it('marks malformed payloads and captures failure reason while providing defaults', () => {
    const normalized = normalizeRawConnectorEvent({
      provider: 'GMAIL',
      externalId: 'gmail-inbound-2',
      payload: 42
    });

    expect(normalized.malformed).toBe(true);
    expect(normalized.failureReason).toContain('Payload must be a JSON object.');
    expect(normalized.failureReason).toContain('workflowHint missing or invalid.');
    expect(normalized.failureReason).toContain('sequence missing or out of range 1-20.');
    expect(normalized.payload).toMatchObject({
      workflowHint: 'customer-escalation-resolution',
      sequence: 1,
      runKey: 'gmail-inbound-2',
      minutesSpent: 7
    });
  });
});
