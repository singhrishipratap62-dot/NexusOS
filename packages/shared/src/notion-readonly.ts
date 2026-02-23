export interface NotionCheckpoint {
  nextCursor?: string;
  lastSyncedAt?: string;
}

export interface NotionPullEvent {
  externalId: string;
  occurredAt: string;
  actor: string;
  payload: Record<string, unknown>;
}

export interface NotionPullOptions {
  checkpoint?: NotionCheckpoint;
  oldestFallbackDays?: number;
}

export interface NotionPullResult {
  events: NotionPullEvent[];
  checkpoint: NotionCheckpoint;
  requestCount: number;
}

interface NotionUser {
  id: string;
  object: string;
}

interface NotionPage {
  id: string;
  object: 'page' | 'database';
  created_time: string;
  last_edited_time: string;
  created_by: NotionUser;
  last_edited_by: NotionUser;
  archived: boolean;
  url?: string;
}

interface NotionSearchResponse {
  results: NotionPage[];
  has_more: boolean;
  next_cursor: string | null;
}

export class NotionReadOnlyConnector {
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
    this.baseUrl = options?.baseUrl ?? 'https://api.notion.com/v1';
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

  private async post<T>(path: string, body: Record<string, unknown>): Promise<T> {
    const url = `${this.baseUrl}${path}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28'
          },
          body: JSON.stringify(body)
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '1');
          if (attempt < this.maxRetries) {
            await this.wait(Math.max(retryAfter, 1) * 1000);
            continue;
          }
          throw new Error(`Notion API ${path} rate limited after retries`);
        }

        if (!response.ok) {
          const errBody = (await response.json()) as { message?: string };
          const retriable = response.status >= 500;
          if (retriable && attempt < this.maxRetries) {
            await this.wait(this.backoffMs(attempt));
            continue;
          }
          throw new Error(`Notion API ${path} failed: ${errBody.message ?? response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt >= this.maxRetries) throw error;
        await this.wait(this.backoffMs(attempt));
      }
    }

    throw new Error(`Notion API ${path} failed after retries`);
  }

  async pullPages(options?: NotionPullOptions): Promise<NotionPullResult> {
    const checkpoint = options?.checkpoint ?? {};
    const cutoffMs = Date.now() - (options?.oldestFallbackDays ?? 30) * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoffMs).toISOString();

    const events: NotionPullEvent[] = [];
    let requestCount = 0;
    let nextCursor: string | undefined = checkpoint.nextCursor;

    do {
      const body: Record<string, unknown> = {
        filter: { value: 'page', property: 'object' },
        sort: { direction: 'ascending', timestamp: 'last_edited_time' },
        page_size: 100
      };
      if (nextCursor) body.start_cursor = nextCursor;

      const response = await this.post<NotionSearchResponse>('/search', body);
      requestCount++;

      for (const page of response.results) {
        if (page.archived) continue;
        if (page.last_edited_time < cutoffDate) continue;

        const isNew = page.created_time === page.last_edited_time;
        events.push({
          externalId: `notion-page-${page.id}`,
          occurredAt: page.last_edited_time,
          actor: page.last_edited_by.id,
          payload: {
            pageId: page.id,
            type: isNew ? 'page_created' : 'page_updated',
            created_time: page.created_time,
            last_edited_time: page.last_edited_time,
            workflowHint: 'knowledge-base-update',
            sequence: isNew ? 1 : 2,
            runKey: page.id,
            minutesSpent: isNew ? 30 : 15
          }
        });
      }

      nextCursor =
        response.has_more && response.next_cursor ? response.next_cursor : undefined;
    } while (nextCursor);

    return {
      events,
      checkpoint: {
        nextCursor: undefined,
        lastSyncedAt: new Date().toISOString()
      },
      requestCount
    };
  }
}
