import { describe, expect, it, vi } from 'vitest';
import { PipelineService } from '../src/pipeline/pipeline.service';

describe('PipelineService.normalizeProviderEvents', () => {
  it('emits canonical normalized events for both Slack and Gmail', async () => {
    const now = new Date('2026-02-22T12:00:00.000Z');
    const rawEventFindMany = vi
      .fn()
      .mockResolvedValueOnce([
        {
          id: 'raw_slack_1',
          externalId: 'C123:1700000.001',
          payload: {
            channel: '#support-triage',
            ts: '1700000.001',
            text: 'Investigate escalation',
            workflowHint: 'customer-escalation-resolution',
            sequence: 2,
            runKey: 'support-1',
            minutesSpent: 11
          },
          occurredAt: now
        }
      ])
      .mockResolvedValueOnce([
        {
          id: 'raw_gmail_1',
          externalId: 'gmail-reply-1',
          payload: {
            labelIds: ['SENT'],
            threadId: 'thread-1',
            workflowHint: 'customer-escalation-resolution',
            sequence: 3,
            runKey: 'support-1',
            minutesSpent: 14
          },
          occurredAt: now
        }
      ]);

    const normalizedUpsert = vi.fn().mockResolvedValue(undefined);

    const prismaMock = {
      rawEvent: {
        findMany: rawEventFindMany
      },
      normalizedEvent: {
        upsert: normalizedUpsert
      }
    };

    const service = new PipelineService(prismaMock as never, {} as never);

    const slackResult = await service.normalizeProviderEvents('tenant_day1', 'SLACK');
    const gmailResult = await service.normalizeProviderEvents('tenant_day1', 'GMAIL');

    expect(slackResult).toEqual({
      normalized: 1,
      malformed: 0
    });
    expect(gmailResult).toEqual({
      normalized: 1,
      malformed: 0
    });

    expect(normalizedUpsert).toHaveBeenCalledTimes(2);
    expect(normalizedUpsert.mock.calls[0]?.[0]?.create).toMatchObject({
      tenantId: 'tenant_day1',
      provider: 'SLACK',
      actor: 'support-lead',
      tool: 'Slack',
      action: 'triage_request',
      channel: '#support-triage',
      malformed: false
    });
    expect(normalizedUpsert.mock.calls[1]?.[0]?.create).toMatchObject({
      tenantId: 'tenant_day1',
      provider: 'GMAIL',
      actor: 'support-agent',
      tool: 'Gmail',
      action: 'respond_to_customer',
      channel: null,
      malformed: false
    });
  });

  it('marks malformed records with failure reason and still emits normalized output', async () => {
    const rawEventFindMany = vi.fn().mockResolvedValue([
      {
        id: 'raw_bad_1',
        externalId: 'gmail-inbound-bad',
        payload: 5,
        occurredAt: new Date('2026-02-22T12:00:00.000Z')
      }
    ]);

    const normalizedUpsert = vi.fn().mockResolvedValue(undefined);

    const prismaMock = {
      rawEvent: {
        findMany: rawEventFindMany
      },
      normalizedEvent: {
        upsert: normalizedUpsert
      }
    };

    const service = new PipelineService(prismaMock as never, {} as never);
    const result = await service.normalizeProviderEvents('tenant_day1', 'GMAIL');

    expect(result).toEqual({
      normalized: 1,
      malformed: 1
    });

    expect(normalizedUpsert).toHaveBeenCalledTimes(1);
    const createData = normalizedUpsert.mock.calls[0]?.[0]?.create;
    expect(createData.malformed).toBe(true);
    expect(createData.failureReason).toContain('Payload must be a JSON object.');
    expect(createData.failureReason).toContain('workflowHint missing or invalid.');
    expect(createData.failureReason).toContain('sequence missing or out of range 1-20.');
    expect(createData.payload).toMatchObject({
      workflowHint: 'customer-escalation-resolution',
      sequence: 1
    });
  });
});
