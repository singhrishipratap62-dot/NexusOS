export interface SlackReadOnlyCheckpoint {
  lastSyncedTs?: string;
  channelListCursor?: string;
  channelCursors?: Record<string, string>;
  syncedAt?: string;
}

export interface SlackPullEvent {
  externalId: string;
  occurredAt: string;
  actor: string;
  channel: string;
  payload: Record<string, unknown>;
}

interface SlackChannel {
  id?: string;
}

interface SlackMessage {
  ts?: string;
  user?: string;
  text?: string;
  subtype?: string;
}

interface SlackCursorMetadata {
  next_cursor?: string;
}

interface SlackApiEnvelope {
  ok?: boolean;
  error?: string;
  response_metadata?: SlackCursorMetadata;
}

interface SlackListChannelsResponse extends SlackApiEnvelope {
  channels?: SlackChannel[];
}

interface SlackHistoryResponse extends SlackApiEnvelope {
  messages?: SlackMessage[];
}

export interface SlackPullOptions {
  checkpoint?: SlackReadOnlyCheckpoint;
  channelIds?: string[];
  oldestFallbackSeconds?: number;
  listPageSize?: number;
  historyPageSize?: number;
}

export interface SlackPullResult {
  events: SlackPullEvent[];
  checkpoint: SlackReadOnlyCheckpoint;
  requestCount: number;
  pageCount: number;
}

function parseUnixTs(ts: string | undefined): number {
  if (!ts) {
    return 0;
  }

  const numeric = Number(ts);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return numeric;
}

function asIsoFromUnixTs(ts: string): string {
  const numeric = parseUnixTs(ts);
  return new Date(Math.floor(numeric * 1000)).toISOString();
}

const RETRIABLE_SLACK_ERRORS = new Set([
  'ratelimited',
  'internal_error',
  'fatal_error',
  'request_timeout',
  'service_unavailable'
]);

export class SlackReadOnlyConnector {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(
    private readonly accessToken: string,
    options?: {
      baseUrl?: string;
      fetchImpl?: typeof fetch;
      maxRetries?: number;
      initialBackoffMs?: number;
    }
  ) {
    this.baseUrl = options?.baseUrl ?? 'https://slack.com/api';
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.maxRetries = options?.maxRetries ?? 4;
    this.initialBackoffMs = options?.initialBackoffMs ?? 350;
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffMs(attempt: number): number {
    return this.initialBackoffMs * 2 ** attempt;
  }

  private async request<T extends SlackApiEnvelope>(
    path: string,
    params: Record<string, string | number | undefined>
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

        if (response.status === 429) {
          if (attempt >= this.maxRetries) {
            throw new Error(`Slack API ${path} exceeded retry budget after rate limit`);
          }

          const retryAfterSeconds = Number(response.headers.get('retry-after') ?? '1');
          await this.wait(Math.max(1, retryAfterSeconds) * 1000);
          continue;
        }

        const body = (await response.json()) as T;

        if (!response.ok || body.ok === false) {
          const errorCode = body.error ?? `http_${response.status}`;
          const retriable =
            response.status >= 500 || RETRIABLE_SLACK_ERRORS.has(errorCode);

          if (retriable && attempt < this.maxRetries) {
            await this.wait(this.backoffMs(attempt));
            continue;
          }

          throw new Error(`Slack API ${path} failed: ${errorCode}`);
        }

        return body;
      } catch (error) {
        if (attempt >= this.maxRetries) {
          throw error;
        }

        await this.wait(this.backoffMs(attempt));
      }
    }

    throw new Error(`Slack API ${path} failed after retries`);
  }

  async pullMessages(options?: SlackPullOptions): Promise<SlackPullResult> {
    const checkpoint = options?.checkpoint ?? {};
    const channelCursors: Record<string, string> = {
      ...(checkpoint.channelCursors ?? {})
    };

    let requestCount = 0;
    let pageCount = 0;

    const oldest =
      checkpoint.lastSyncedTs ??
      String(
        Math.floor(
          (Date.now() - (options?.oldestFallbackSeconds ?? 30 * 24 * 60 * 60) * 1000) / 1000
        )
      );

    const discoveredChannels = new Set<string>(options?.channelIds ?? []);

    if (discoveredChannels.size === 0) {
      let cursor: string | undefined = checkpoint.channelListCursor;

      do {
        const response: SlackListChannelsResponse = await this.request<SlackListChannelsResponse>(
          '/conversations.list',
          {
          limit: options?.listPageSize ?? 200,
          exclude_archived: 'true',
          types: 'public_channel,private_channel',
          cursor
          }
        );
        requestCount += 1;
        pageCount += 1;

        for (const channel of response.channels ?? []) {
          if (channel.id) {
            discoveredChannels.add(channel.id);
          }
        }

        cursor = response.response_metadata?.next_cursor || undefined;
      } while (cursor);
    }

    const events: SlackPullEvent[] = [];
    let maxSeenTs = parseUnixTs(checkpoint.lastSyncedTs);

    for (const channelId of discoveredChannels) {
      let cursor: string | undefined = channelCursors[channelId];

      do {
        const response: SlackHistoryResponse = await this.request<SlackHistoryResponse>(
          '/conversations.history',
          {
            channel: channelId,
            limit: options?.historyPageSize ?? 200,
            oldest,
            cursor,
            inclusive: 'false'
          }
        );
        requestCount += 1;
        pageCount += 1;

        for (const message of response.messages ?? []) {
          if (!message.ts) {
            continue;
          }

          const tsNumeric = parseUnixTs(message.ts);
          if (tsNumeric > maxSeenTs) {
            maxSeenTs = tsNumeric;
          }

          events.push({
            externalId: `${channelId}:${message.ts}`,
            occurredAt: asIsoFromUnixTs(message.ts),
            actor: message.user ?? 'unknown',
            channel: channelId,
            payload: {
              channel: channelId,
              ts: message.ts,
              text: message.text ?? '',
              subtype: message.subtype ?? null,
              workflowHint: 'slack-support-triage',
              sequence: 2,
              minutesSpent: 5
            }
          });
        }

        cursor = response.response_metadata?.next_cursor || undefined;
        if (cursor) {
          channelCursors[channelId] = cursor;
        } else {
          delete channelCursors[channelId];
        }
      } while (cursor);
    }

    return {
      events,
      checkpoint: {
        lastSyncedTs: maxSeenTs > 0 ? String(maxSeenTs) : checkpoint.lastSyncedTs,
        channelCursors,
        syncedAt: new Date().toISOString()
      },
      requestCount,
      pageCount
    };
  }
}
