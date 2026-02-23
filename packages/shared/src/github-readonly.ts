export interface GitHubCheckpoint {
  since?: string;
  syncedAt?: string;
}

export interface GitHubPullEvent {
  externalId: string;
  occurredAt: string;
  actor: string;
  channel: string; // repo full_name
  payload: Record<string, unknown>;
}

export interface GitHubPullOptions {
  checkpoint?: GitHubCheckpoint;
  repos?: string[]; // "owner/repo" strings; empty = fetch from user's repos
  oldestFallbackDays?: number;
}

export interface GitHubPullResult {
  events: GitHubPullEvent[];
  checkpoint: GitHubCheckpoint;
  requestCount: number;
}

interface GitHubRepo {
  full_name: string;
}

interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  user: { login: string } | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  pull_request?: { url: string };
  html_url: string;
}

interface GitHubApiErrorResponse {
  message?: string;
}

export class GitHubReadOnlyConnector {
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
    this.baseUrl = options?.baseUrl ?? 'https://api.github.com';
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

  private async request<T>(
    path: string,
    params: Record<string, string | number | undefined> = {}
  ): Promise<T> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        query.set(key, String(value));
      }
    }

    const qs = query.toString();
    const url = `${this.baseUrl}${path}${qs ? '?' + qs : ''}`;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await this.fetchImpl(url, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });

        if (response.status === 403 || response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? '60');
          if (attempt < this.maxRetries) {
            await this.wait(Math.max(retryAfter, 1) * 1000);
            continue;
          }
          throw new Error(`GitHub API ${path} rate limited after retries`);
        }

        if (response.status === 401) {
          throw new Error(`GitHub API ${path} unauthorized: check token permissions`);
        }

        if (!response.ok) {
          const body = (await response.json()) as GitHubApiErrorResponse;
          const retriable = response.status >= 500;
          if (retriable && attempt < this.maxRetries) {
            await this.wait(this.backoffMs(attempt));
            continue;
          }
          throw new Error(`GitHub API ${path} failed: ${body.message ?? response.status}`);
        }

        return (await response.json()) as T;
      } catch (error) {
        if (attempt >= this.maxRetries) throw error;
        await this.wait(this.backoffMs(attempt));
      }
    }

    throw new Error(`GitHub API ${path} failed after retries`);
  }

  async pullIssues(options?: GitHubPullOptions): Promise<GitHubPullResult> {
    const checkpoint = options?.checkpoint ?? {};
    const since =
      checkpoint.since ??
      new Date(
        Date.now() - (options?.oldestFallbackDays ?? 30) * 24 * 60 * 60 * 1000
      ).toISOString();

    let repos = options?.repos ?? [];
    let requestCount = 0;

    if (repos.length === 0) {
      const repoList = await this.request<GitHubRepo[]>('/user/repos', {
        per_page: 100,
        sort: 'updated',
        direction: 'desc'
      });
      requestCount++;
      repos = repoList.map((r) => r.full_name);
    }

    const events: GitHubPullEvent[] = [];
    let maxUpdatedAt = since;

    for (const repo of repos.slice(0, 10)) {
      const issues = await this.request<GitHubIssue[]>(`/repos/${repo}/issues`, {
        state: 'all',
        since,
        per_page: 100,
        sort: 'updated',
        direction: 'asc'
      });
      requestCount++;

      for (const issue of issues) {
        if (!issue.id) continue;

        const isPR = Boolean(issue.pull_request);
        const occurredAt = issue.updated_at ?? issue.created_at;
        if (occurredAt > maxUpdatedAt) maxUpdatedAt = occurredAt;

        let sequence = 1;
        if (isPR) {
          sequence = issue.state === 'closed' ? 3 : 2;
        } else {
          sequence = issue.state === 'closed' ? 3 : 1;
        }

        events.push({
          externalId: `github-${repo.replace('/', '-')}-${isPR ? 'pr' : 'issue'}-${issue.number}`,
          occurredAt,
          actor: issue.user?.login ?? 'unknown',
          channel: repo,
          payload: {
            type: isPR ? 'pull_request' : 'issue',
            number: issue.number,
            title: issue.title,
            state: issue.state,
            repo,
            html_url: issue.html_url,
            closed_at: issue.closed_at,
            workflowHint: isPR ? 'code-review-workflow' : 'issue-triage-workflow',
            sequence,
            runKey: `${repo}-${isPR ? 'pr' : 'issue'}-${issue.number}`,
            minutesSpent: isPR ? 45 : 20
          }
        });
      }
    }

    return {
      events,
      checkpoint: {
        since: maxUpdatedAt,
        syncedAt: new Date().toISOString()
      },
      requestCount
    };
  }
}
