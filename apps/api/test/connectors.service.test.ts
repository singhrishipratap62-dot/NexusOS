import { describe, expect, it, vi } from 'vitest';
import { ConnectorsService } from '../src/connectors/connectors.service';
import { decryptToken } from '@nexus/shared';

function createJsonResponse(body: unknown, init?: { status?: number }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json'
    }
  });
}

describe('ConnectorsService', () => {
  it('creates Slack OAuth start URL with read-only scopes', () => {
    process.env.SLACK_CLIENT_ID = 'client-123';
    process.env.SLACK_REDIRECT_URI = 'http://localhost:3000/connectors/slack/callback';
    process.env.SLACK_READ_SCOPES = 'channels:read,channels:history';

    const service = new ConnectorsService(
      {} as never,
      {} as never,
      {} as never
    );

    const result = service.getSlackOAuthStartUrl('tenant_day1');
    const url = new URL(result.url);

    expect(url.origin).toBe('https://slack.com');
    expect(url.searchParams.get('client_id')).toBe('client-123');
    expect(url.searchParams.get('scope')).toBe('channels:read,channels:history');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/connectors/slack/callback'
    );
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('creates Gmail OAuth start URL with read-only scope', () => {
    process.env.GMAIL_CLIENT_ID = 'gmail-client-123';
    process.env.GMAIL_REDIRECT_URI = 'http://localhost:3000/connectors/gmail/callback';
    process.env.GMAIL_READ_SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

    const service = new ConnectorsService(
      {} as never,
      {} as never,
      {} as never
    );

    const result = service.getGmailOAuthStartUrl('tenant_day1');
    const url = new URL(result.url);

    expect(url.origin).toBe('https://accounts.google.com');
    expect(url.searchParams.get('client_id')).toBe('gmail-client-123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/connectors/gmail/callback'
    );
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.readonly');
    expect(url.searchParams.get('state')).toBeTruthy();
  });

  it('exchanges Gmail OAuth code and stores connector credentials', async () => {
    process.env.GMAIL_CLIENT_ID = 'gmail-client-123';
    process.env.GMAIL_CLIENT_SECRET = 'gmail-secret-123';
    process.env.GMAIL_REDIRECT_URI = 'http://localhost:3000/connectors/gmail/callback';

    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      createJsonResponse({
        access_token: 'gmail-access-token',
        refresh_token: 'gmail-refresh-token',
        scope: 'https://www.googleapis.com/auth/gmail.readonly'
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const connectorUpdate = vi.fn().mockResolvedValue(undefined);
    const prismaMock = {
      connector: {
        update: connectorUpdate
      }
    };

    const pipelineMock = {
      ensureTenant: vi.fn().mockResolvedValue(undefined),
      ensureConnector: vi.fn().mockResolvedValue({ id: 'connector-gmail-1' })
    };

    const service = new ConnectorsService(
      prismaMock as never,
      pipelineMock as never,
      {} as never
    );

    const result = await service.exchangeGmailOAuthCode({
      tenantId: 'tenant_day1',
      code: 'gmail-auth-code'
    });

    expect(result).toEqual({
      connectorId: 'connector-gmail-1',
      provider: 'GMAIL',
      scope: 'https://www.googleapis.com/auth/gmail.readonly'
    });

    const requestBody = String(fetchMock.mock.calls[0]?.[1]?.body);
    expect(requestBody).toContain('grant_type=authorization_code');
    expect(requestBody).toContain('code=gmail-auth-code');

    // Tokens are stored encrypted — verify they decrypt to the original values
    const updateCall = connectorUpdate.mock.calls[0]?.[0];
    expect(updateCall.where).toEqual({ id: 'connector-gmail-1' });
    expect(updateCall.data.checkpoint).toEqual({});
    expect(decryptToken(updateCall.data.accessToken)).toBe('gmail-access-token');
    expect(decryptToken(updateCall.data.refreshToken)).toBe('gmail-refresh-token');

    vi.unstubAllGlobals();
  });

  it('tracks sync job lifecycle during inline fallback success', async () => {
    const syncJobCreate = vi.fn().mockResolvedValue({ id: 'job-1' });
    const syncJobUpdate = vi.fn().mockResolvedValue(undefined);

    const prismaMock = {
      syncJob: {
        create: syncJobCreate,
        update: syncJobUpdate,
        findMany: vi.fn().mockResolvedValue([])
      },
      connector: {
        findMany: vi.fn().mockResolvedValue([])
      }
    };

    const pipelineMock = {
      ensureTenant: vi.fn().mockResolvedValue(undefined),
      ensureConnector: vi.fn().mockResolvedValue({ id: 'connector-1' }),
      ingestProviderFixtures: vi.fn().mockResolvedValue(undefined),
      normalizeProviderEvents: vi.fn().mockResolvedValue(undefined)
    };

    const queueServiceMock = {
      enqueueConnectorSync: vi.fn().mockRejectedValue(new Error('redis unavailable'))
    };

    const service = new ConnectorsService(
      prismaMock as never,
      pipelineMock as never,
      queueServiceMock as never
    );

    const result = await service.queueSync('tenant_day1', 'SLACK');

    expect(result.mode).toBe('INLINE_FALLBACK');
    expect(syncJobUpdate).toHaveBeenCalledTimes(2);
    expect(syncJobUpdate.mock.calls[0]?.[0]?.data?.status).toBe('RUNNING');
    expect(syncJobUpdate.mock.calls[1]?.[0]?.data?.status).toBe('SUCCEEDED');
  });
});
