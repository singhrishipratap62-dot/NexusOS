import { describe, expect, it, vi } from 'vitest';
import { GmailReadOnlyConnector } from '../src/gmail-readonly';

function createJsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('GmailReadOnlyConnector', () => {
  it('paginates, maps messages, and emits incremental checkpoint', async () => {
    const buildFetchMock = () =>
      vi
        .fn<typeof fetch>()
        .mockResolvedValueOnce(
          createJsonResponse({
            messages: [{ id: 'm1', threadId: 't1' }],
            nextPageToken: 'page-2'
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 'm1',
            threadId: 't1',
            internalDate: '1700000000000',
            labelIds: ['INBOX'],
            snippet: 'Inbound escalation',
            payload: {
              headers: [
                { name: 'From', value: 'customer@example.com' },
                { name: 'Subject', value: 'Need help' }
              ]
            }
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            messages: [{ id: 'm2', threadId: 't1' }],
            nextPageToken: ''
          })
        )
        .mockResolvedValueOnce(
          createJsonResponse({
            id: 'm2',
            threadId: 't1',
            internalDate: '1700000005000',
            labelIds: ['SENT'],
            snippet: 'Support follow-up',
            payload: {
              headers: [
                { name: 'From', value: 'support@example.com' },
                { name: 'Subject', value: 'Re: Need help' }
              ]
            }
          })
        );

    const pageFetchMock = buildFetchMock();

    const pageConnector = new GmailReadOnlyConnector('gmail-token', {
      fetchImpl: pageFetchMock,
      initialBackoffMs: 1
    });

    const pages = [];
    for await (const page of pageConnector.pullMessagePages({
      checkpoint: {
        lastInternalDateMs: '1699990000000'
      }
    })) {
      pages.push(page);
    }

    expect(pages).toHaveLength(2);
    expect(pages[0]?.checkpoint.nextPageToken).toBe('page-2');
    expect(pages[1]?.checkpoint.nextPageToken).toBeUndefined();
    expect(pages[1]?.checkpoint.lastInternalDateMs).toBe('1700000005000');
    expect(pageFetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer gmail-token'
    });

    const firstListUrl = new URL(String(pageFetchMock.mock.calls[0]?.[0]));
    expect(firstListUrl.searchParams.get('q')).toContain('after:');

    const resultFetchMock = buildFetchMock();
    const resultConnector = new GmailReadOnlyConnector('gmail-token', {
      fetchImpl: resultFetchMock,
      initialBackoffMs: 1
    });

    const result = await resultConnector.pullMessages({
      checkpoint: {
        lastInternalDateMs: '1699990000000'
      }
    });

    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.actor).toBe('customer');
    expect(result.events[1]?.actor).toBe('support-agent');
    expect(result.events[1]?.payload.sequence).toBe(3);
    expect(result.checkpoint.lastInternalDateMs).toBe('1700000005000');
    expect(result.checkpoint.nextPageToken).toBeUndefined();
  });

  it('resumes from saved page token and retries on rate-limit responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse(
          { error: { status: 'RESOURCE_EXHAUSTED', message: 'Slow down' } },
          {
            status: 429,
            headers: { 'retry-after': '0' }
          }
        )
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          messages: [{ id: 'm2', threadId: 't2' }],
          nextPageToken: ''
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          id: 'm2',
          threadId: 't2',
          internalDate: '1700000010000',
          labelIds: ['INBOX'],
          payload: {
            headers: [
              { name: 'From', value: 'customer2@example.com' },
              { name: 'Subject', value: 'Escalation update' }
            ]
          }
        })
      );

    const connector = new GmailReadOnlyConnector('gmail-token', {
      fetchImpl: fetchMock,
      initialBackoffMs: 1,
      maxRetries: 3
    });

    const result = await connector.pullMessages({
      checkpoint: {
        lastInternalDateMs: '1700000000000',
        nextPageToken: 'page-2'
      }
    });

    const resumedListUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(resumedListUrl.searchParams.get('pageToken')).toBe('page-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.events).toHaveLength(1);
    expect(result.checkpoint.lastInternalDateMs).toBe('1700000010000');
  });
});
