export interface JiraCheckpoint {
  updatedAfter?: string;
  syncedAt?: string;
}

export interface JiraPullEvent {
  externalId: string;
  occurredAt: string;
  actor: string;
  channel: string; // project key
  payload: Record<string, unknown>;
}

export interface JiraPullOptions {
  checkpoint?: JiraCheckpoint;
  oldestFallbackDays?: number;
}

export interface JiraPullResult {
  events: JiraPullEvent[];
  checkpoint: JiraCheckpoint;
  requestCount: number;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string; statusCategory: { key: string } };
    assignee: { displayName: string; accountId: string } | null;
    reporter: { displayName: string; accountId: string } | null;
    project: { key: string; name: string };
    created: string;
    updated: string;
    resolutiondate: string | null;
    issuetype: { name: string };
    priority: { name: string };
    timespent: number | null;
    timeoriginalestimate: number | null;
  };
}

interface JiraSearchResponse {
  issues: JiraIssue[];
  total: number;
  startAt: number;
  maxResults: number;
}

export class JiraReadOnlyConnector {
  private readonly fetchImpl: typeof fetch;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(
    private readonly accessToken: string,
    private readonly cloudId: string,
    options?: {
      fetchImpl?: typeof fetch;
      maxRetries?: number;
      initialBackoffMs?: number;
    }
  ) {
    this.fetchImpl = options?.fetchImpl ?? fetch;
    this.maxRetries = options?.maxRetries ?? 4;
    this.initialBackoffMs = options?.initialBackoffMs ?? 350;
  }

  private get baseUrl(): string {
    return `https://api.atlassian.com/ex/jira/${this.cloudId}/rest/api/3`;
  }

  private async wait(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private backoffMs(attempt: number): number {
    return this.initialBackoffMs * 2 ** attempt;
  }

  private async get<T>(
    path: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) query.set(key, String(value));
    }

    const url = `${this.baseUrl}${path}?${query.toString()}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: 'application/json'
          }
        });

        if (response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '1');
          if (attempt < this.maxRetries) {
            await this.wait(Math.max(retryAfter, 1) * 1000);
            continue;
          }
          throw new Error(`Jira API ${path} rate limited after retries`);
        }

        if (!response.ok) {
          const retriable = response.status >= 500;
          if (retriable && attempt < this.maxRetries) {
            await this.wait(this.backoffMs(attempt));
            continue;
          }
          throw new Error(`Jira API ${path} failed: HTTP ${response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt >= this.maxRetries) throw error;
        await this.wait(this.backoffMs(attempt));
      }
    }

    throw new Error(`Jira API ${path} failed after retries`);
  }

  async pullIssues(options?: JiraPullOptions): Promise<JiraPullResult> {
    const checkpoint = options?.checkpoint ?? {};
    const since =
      checkpoint.updatedAfter ??
      new Date(
        Date.now() - (options?.oldestFallbackDays ?? 30) * 24 * 60 * 60 * 1000
      )
        .toISOString()
        .split('T')[0];

    const jql = `updated >= "${since.split('T')[0]}" ORDER BY updated ASC`;
    const maxResults = 50;
    const events: JiraPullEvent[] = [];
    let requestCount = 0;
    let startAt = 0;
    let total = 1;

    while (startAt < total) {
      const response = await this.get<JiraSearchResponse>('/search', {
        jql,
        startAt,
        maxResults,
        fields:
          'summary,status,assignee,reporter,project,created,updated,resolutiondate,issuetype,priority,timespent,timeoriginalestimate'
      });
      requestCount++;
      total = response.total;

      for (const issue of response.issues) {
        const category = issue.fields.status.statusCategory.key;
        let sequence = 1;
        if (category === 'indeterminate') sequence = 2;
        if (category === 'done') sequence = 3;

        events.push({
          externalId: `jira-issue-${issue.id}`,
          occurredAt: issue.fields.updated,
          actor:
            issue.fields.assignee?.displayName ??
            issue.fields.reporter?.displayName ??
            'unknown',
          channel: issue.fields.project.key,
          payload: {
            id: issue.id,
            key: issue.key,
            summary: issue.fields.summary,
            statusName: issue.fields.status.name,
            statusCategory: category,
            projectKey: issue.fields.project.key,
            projectName: issue.fields.project.name,
            issuetype: issue.fields.issuetype.name,
            priority: issue.fields.priority.name,
            resolutiondate: issue.fields.resolutiondate,
            timeSpentSeconds: issue.fields.timespent,
            workflowHint: 'sprint-workflow',
            sequence,
            runKey: issue.key,
            minutesSpent: issue.fields.timespent
              ? Math.ceil(issue.fields.timespent / 60)
              : 25
          }
        });
      }

      startAt += response.issues.length;
      if (response.issues.length < maxResults) break;
    }

    return {
      events,
      checkpoint: {
        updatedAfter: new Date().toISOString(),
        syncedAt: new Date().toISOString()
      },
      requestCount
    };
  }

  /** Fetches the cloudId for the first accessible Atlassian site. */
  static async fetchCloudId(accessToken: string): Promise<string> {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Jira cloud ID: HTTP ${response.status}`);
    }

    const resources = (await response.json()) as Array<{ id: string; name: string }>;
    if (!resources.length) {
      throw new Error('No accessible Jira sites found for this token');
    }

    return resources[0].id;
  }
}
