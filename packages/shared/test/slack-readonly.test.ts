import { describe, expect, it, vi } from 'vitest';
import { SlackReadOnlyConnector } from '../src/slack-readonly';

function createJsonResponse(body: unknown, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {})
    }
  });
}

describe('SlackReadOnlyConnector', () => {
  it('uses pagination for channels/history and emits checkpoint', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          channels: [{ id: 'C1' }],
          response_metadata: { next_cursor: 'cursor-2' }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          channels: [{ id: 'C2' }],
          response_metadata: { next_cursor: '' }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          messages: [{ ts: '1700000000.000100', user: 'U1', text: 'hello' }],
          response_metadata: { next_cursor: '' }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          messages: [{ ts: '1700000001.000200', user: 'U2', text: 'world' }],
          response_metadata: { next_cursor: '' }
        })
      );

    const connector = new SlackReadOnlyConnector('token-123', {
      fetchImpl: fetchMock,
      initialBackoffMs: 1
    });

    const result = await connector.pullMessages({
      checkpoint: {
        lastSyncedTs: '1699990000.000000'
      }
    });

    expect(result.events).toHaveLength(2);
    expect(result.pageCount).toBe(4);
    expect(result.requestCount).toBe(4);
    expect(result.checkpoint.lastSyncedTs).toBe('1700000001.0002');
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: 'Bearer token-123'
    });
  });

  it('retries on rate limit and succeeds', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        createJsonResponse(
          { ok: false, error: 'ratelimited' },
          {
            status: 429,
            headers: { 'retry-after': '0' }
          }
        )
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          channels: [{ id: 'C1' }],
          response_metadata: { next_cursor: '' }
        })
      )
      .mockResolvedValueOnce(
        createJsonResponse({
          ok: true,
          messages: [],
          response_metadata: { next_cursor: '' }
        })
      );

    const connector = new SlackReadOnlyConnector('token-123', {
      fetchImpl: fetchMock,
      initialBackoffMs: 1,
      maxRetries: 3
    });

    const result = await connector.pullMessages();

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.events).toHaveLength(0);
  });
});
