export interface GmailReadOnlyCheckpoint {
  lastInternalDateMs?: string;
  nextPageToken?: string;
  syncedAt?: string;
}

export interface GmailPullEvent {
  externalId: string;
  occurredAt: string;
  actor: string;
  payload: Record<string, unknown>;
}

interface GmailApiError {
  status?: string;
  message?: string;
}

interface GmailListMessage {
  id?: string;
  threadId?: string;
}

interface GmailListResponse {
  messages?: GmailListMessage[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
  error?: GmailApiError;
}

interface GmailHeader {
  name?: string;
  value?: string;
}

interface GmailMessagePayload {
  headers?: GmailHeader[];
}

interface GmailMessageResponse {
  id?: string;
  threadId?: string;
  historyId?: string;
  internalDate?: string;
  labelIds?: string[];
  snippet?: string;
  payload?: GmailMessagePayload;
  error?: GmailApiError;
}

interface GmailApiErrorEnvelope {
  error?: GmailApiError;
}

class NonRetriableRequestError extends Error { }

function parseInternalDateMs(value: string | number | undefined): number {
  if (value === undefined) {
    return 0;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.floor(numeric);
}

function toIsoFromEpochMs(ms: number): string {
  return new Date(ms).toISOString();
}

function getHeaderValue(
  headers: GmailHeader[] | undefined,
  targetHeaderName: string
): string | null {
  if (!headers || headers.length === 0) {
    return null;
  }

  const normalizedTarget = targetHeaderName.toLowerCase();

  for (const header of headers) {
    if (header.name?.toLowerCase() === normalizedTarget) {
      return header.value ?? null;
    }
  }

  return null;
}

export interface GmailPullOptions {
  checkpoint?: GmailReadOnlyCheckpoint;
  pageSize?: number;
  oldestFallbackSeconds?: number;
  query?: string;
}

export interface GmailPullPageResult {
  events: GmailPullEvent[];
  checkpoint: GmailReadOnlyCheckpoint;
  requestCount: number;
  pageCount: number;
}

export interface GmailPullResult {
  events: GmailPullEvent[];
  checkpoint: GmailReadOnlyCheckpoint;
  requestCount: number;
  pageCount: number;
}

export class GmailReadOnlyConnector {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private accessToken: string;
  private readonly refreshToken?: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly onTokenRefresh?: (newToken: string) => Promise<void>;

  constructor(
    accessToken: string,
    options?: {
      baseUrl?: string;
      fetchImpl?: typeof fetch;
      maxRetries?: number;
      initialBackoffMs?: number;
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
      onTokenRefresh?: (newToken: string) => Promise<void>;
    }
  ) {
    this.accessToken = accessToken;
    this.baseUrl = options?.baseUrl ?? 'https://gmail.googleapis.com/gmail/v1/users/me';
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.maxRetries = options?.maxRetries ?? 4;
    this.initialBackoffMs = options?.initialBackoffMs ?? 350;
    this.refreshToken = options?.refreshToken;
    this.clientId = options?.clientId;
    this.clientSecret = options?.clientSecret;
    this.onTokenRefresh = options?.onTokenRefresh;
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffMs(attempt: number): number {
    return this.initialBackoffMs * 2 ** attempt;
  }

  private async performTokenRefresh(): Promise<void> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      throw new Error('Cannot refresh token: missing refreshToken, clientId, or clientSecret');
    }

    const response = await this.fetchImpl('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      throw new NonRetriableRequestError(`Failed to refresh access token: HTTP ${response.status}`);
    }

    const payload = await response.json() as { access_token?: string };
    if (!payload.access_token) {
      throw new NonRetriableRequestError('Failed to refresh access token: no access_token in response');
    }

    this.accessToken = payload.access_token;
    if (this.onTokenRefresh) {
      await this.onTokenRefresh(this.accessToken);
    }
  }

  private parseRetryAfterMs(headers: Headers): number | null {
    const retryAfterRaw = headers.get('retry-after');
    if (!retryAfterRaw) {
      return null;
    }

    const retryAfterSeconds = Number(retryAfterRaw);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
      return Math.max(1, retryAfterSeconds) * 1000;
    }

    return null;
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number | boolean | undefined>
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }
      query.set(key, String(value));
    }

    const url = `${this.baseUrl}${path}?${query.toString()}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`
          }
        });

        if (response.status === 401 && this.refreshToken && attempt < this.maxRetries) {
          try {
            await this.performTokenRefresh();
            continue; // Retry the request with the newly refreshed access token
          } catch (refreshErr) {
            throw new NonRetriableRequestError(`Token refresh failed: ${(refreshErr as Error).message}`);
          }
        }

        const retriableStatus = response.status === 429 || response.status >= 500;
        const body = (await response.json()) as T & GmailApiErrorEnvelope;

        if (!response.ok) {
          const errorStatus = body.error?.status ?? `http_${response.status}`;
          const errorMessage = body.error?.message ?? errorStatus;

          if (retriableStatus && attempt < this.maxRetries) {
            const retryAfterMs =
              this.parseRetryAfterMs(response.headers) ?? this.backoffMs(attempt);
            await this.wait(retryAfterMs);
            continue;
          }

          if (retriableStatus) {
            throw new Error(
              `Gmail API ${path} exceeded retry budget: ${errorStatus} (${errorMessage})`
            );
          }

          throw new NonRetriableRequestError(
            `Gmail API ${path} failed: ${errorStatus} (${errorMessage})`
          );
        }

        return body as T;
      } catch (error) {
        if (error instanceof NonRetriableRequestError) {
          throw error;
        }

        if (attempt >= this.maxRetries) {
          throw error;
        }

        await this.wait(this.backoffMs(attempt));
      }
    }

    throw new Error(`Gmail API ${path} failed after retries`);
  }

  async *pullMessagePages(
    options?: GmailPullOptions
  ): AsyncGenerator<GmailPullPageResult, void, void> {
    const checkpoint = options?.checkpoint ?? {};

    const checkpointMs = parseInternalDateMs(checkpoint.lastInternalDateMs);
    const oldestFallbackMs =
      Date.now() - (options?.oldestFallbackSeconds ?? 30 * 24 * 60 * 60) * 1000;
    const oldestMs = checkpointMs > 0 ? checkpointMs : oldestFallbackMs;

    const queryParts: string[] = [];
    if (options?.query && options.query.trim().length > 0) {
      queryParts.push(options.query.trim());
    }
    queryParts.push(`after:${Math.floor(Math.max(0, oldestMs - 1000) / 1000)}`);
    const query = queryParts.join(' ');

    let nextPageToken: string | undefined = checkpoint.nextPageToken;
    let maxSeenInternalDateMs = checkpointMs;
    let requestCount = 0;
    let pageCount = 0;

    do {
      const listResponse = await this.request<GmailListResponse>('/messages', {
        maxResults: options?.pageSize ?? 100,
        includeSpamTrash: false,
        q: query,
        pageToken: nextPageToken
      });
      requestCount += 1;
      pageCount += 1;

      const pageEvents: GmailPullEvent[] = [];

      for (const listMessage of listResponse.messages ?? []) {
        if (!listMessage.id) {
          continue;
        }

        const details = await this.request<GmailMessageResponse>(
          `/messages/${encodeURIComponent(listMessage.id)}`,
          {
            format: 'metadata'
          }
        );
        requestCount += 1;

        const internalDateMs = parseInternalDateMs(details.internalDate);
        if (internalDateMs <= 0) {
          continue;
        }

        if (internalDateMs > maxSeenInternalDateMs) {
          maxSeenInternalDateMs = internalDateMs;
        }

        const labelIds = details.labelIds ?? [];
        const outbound = labelIds.includes('SENT');
        const messageId = details.id ?? listMessage.id;

        pageEvents.push({
          externalId: messageId,
          occurredAt: toIsoFromEpochMs(internalDateMs),
          actor: outbound ? 'support-agent' : 'customer',
          payload: {
            id: messageId,
            threadId: details.threadId ?? listMessage.threadId ?? null,
            historyId: details.historyId ?? null,
            labelIds,
            from: getHeaderValue(details.payload?.headers, 'From'),
            subject: getHeaderValue(details.payload?.headers, 'Subject'),
            snippet: details.snippet ?? null,
            workflowHint: 'customer-escalation-resolution',
            sequence: outbound ? 3 : 1,
            runKey: details.threadId ?? listMessage.threadId ?? messageId,
            minutesSpent: outbound ? 14 : 7
          }
        });
      }

      nextPageToken = listResponse.nextPageToken || undefined;

      yield {
        events: pageEvents,
        checkpoint: {
          lastInternalDateMs:
            maxSeenInternalDateMs > 0
              ? String(maxSeenInternalDateMs)
              : checkpoint.lastInternalDateMs,
          nextPageToken,
          syncedAt: new Date().toISOString()
        },
        requestCount,
        pageCount
      };
    } while (nextPageToken);
  }

  async pullMessages(options?: GmailPullOptions): Promise<GmailPullResult> {
    const events: GmailPullEvent[] = [];
    let requestCount = 0;
    let pageCount = 0;
    let checkpoint: GmailReadOnlyCheckpoint = {
      ...(options?.checkpoint ?? {})
    };

    for await (const page of this.pullMessagePages(options)) {
      events.push(...page.events);
      checkpoint = page.checkpoint;
      requestCount = page.requestCount;
      pageCount = page.pageCount;
    }

    return {
      events,
      checkpoint: {
        ...checkpoint,
        nextPageToken: undefined,
        syncedAt: new Date().toISOString()
      },
      requestCount,
      pageCount
    };
  }
}
