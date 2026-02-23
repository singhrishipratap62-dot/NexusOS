export interface LinearCheckpoint {
  updatedAfter?: string;
  lastSyncedAt?: string;
}

export interface LinearPullEvent {
  externalId: string;
  occurredAt: string;
  actor: string;
  channel: string; // team key
  payload: Record<string, unknown>;
}

export interface LinearPullOptions {
  checkpoint?: LinearCheckpoint;
  oldestFallbackDays?: number;
}

export interface LinearPullResult {
  events: LinearPullEvent[];
  checkpoint: LinearCheckpoint;
  requestCount: number;
}

interface LinearIssue {
  id: string;
  identifier: string;
  title: string;
  state: { name: string; type: string };
  assignee?: { id: string; name: string } | null;
  creator?: { id: string; name: string } | null;
  team: { id: string; name: string; key: string };
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  priority: number;
  estimate?: number | null;
}

interface LinearIssuesResponse {
  data?: {
    issues?: {
      nodes: LinearIssue[];
    };
  };
  errors?: Array<{ message: string }>;
}

export class LinearReadOnlyConnector {
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
    this.baseUrl = options?.baseUrl ?? 'https://api.linear.app';
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

  private async graphql<T>(
    query: string,
    variables?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}/graphql`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query, variables })
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '1');
          if (attempt < this.maxRetries) {
            await this.wait(Math.max(retryAfter, 1) * 1000);
            continue;
          }
          throw new Error('Linear API rate limited after retries');
        }

        if (!response.ok) {
          const retriable = response.status >= 500;
          if (retriable && attempt < this.maxRetries) {
            await this.wait(this.backoffMs(attempt));
            continue;
          }
          throw new Error(`Linear API failed: HTTP ${response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt >= this.maxRetries) throw error;
        await this.wait(this.backoffMs(attempt));
      }
    }

    throw new Error('Linear API failed after retries');
  }

  async pullIssues(options?: LinearPullOptions): Promise<LinearPullResult> {
    const checkpoint = options?.checkpoint ?? {};
    const updatedAfter =
      checkpoint.updatedAfter ??
      new Date(
        Date.now() - (options?.oldestFallbackDays ?? 30) * 24 * 60 * 60 * 1000
      ).toISOString();

    const query = `
      query IssuesUpdatedAfter($filter: IssueFilter) {
        issues(filter: $filter, orderBy: updatedAt, first: 100) {
          nodes {
            id
            identifier
            title
            state { name type }
            assignee { id name }
            creator { id name }
            team { id name key }
            createdAt
            updatedAt
            completedAt
            priority
            estimate
          }
        }
      }
    `;

    const result = await this.graphql<LinearIssuesResponse>(query, {
      filter: { updatedAt: { gte: updatedAfter } }
    });

    if (result.errors?.length) {
      throw new Error(`Linear GraphQL error: ${result.errors[0].message}`);
    }

    const issues = result.data?.issues?.nodes ?? [];
    const events: LinearPullEvent[] = [];

    for (const issue of issues) {
      const stateType = issue.state.type.toLowerCase();
      let sequence = 1;
      if (stateType === 'started' || stateType === 'in_progress') {
        sequence = 2;
      } else if (stateType === 'completed' || stateType === 'cancelled') {
        sequence = 3;
      }

      events.push({
        externalId: `linear-issue-${issue.id}`,
        occurredAt: issue.updatedAt,
        actor: issue.assignee?.name ?? issue.creator?.name ?? 'unknown',
        channel: issue.team.key,
        payload: {
          id: issue.id,
          identifier: issue.identifier,
          title: issue.title,
          stateName: issue.state.name,
          stateType: issue.state.type,
          teamName: issue.team.name,
          teamKey: issue.team.key,
          priority: issue.priority,
          estimate: issue.estimate ?? null,
          completedAt: issue.completedAt ?? null,
          workflowHint: 'bug-triage-workflow',
          sequence,
          runKey: issue.id,
          minutesSpent: (issue.estimate ?? 1) * 30
        }
      });
    }

    const maxUpdatedAt = issues.reduce(
      (max, i) => (i.updatedAt > max ? i.updatedAt : max),
      updatedAfter
    );

    return {
      events,
      checkpoint: {
        updatedAfter: maxUpdatedAt,
        lastSyncedAt: new Date().toISOString()
      },
      requestCount: 1
    };
  }
}
