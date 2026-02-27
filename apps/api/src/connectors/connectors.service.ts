import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { Prisma, Provider, SyncJobStatus } from '@prisma/client';
import { encryptToken, JiraReadOnlyConnector } from '@nexus/shared';
import { JobQueueService } from '../jobs/job-queue.service';
import { PipelineService } from '../pipeline/pipeline.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ConnectorsService {
  private readonly logger = new Logger(ConnectorsService.name);
  private readonly slackOAuthAuthorizeUrl =
    process.env.SLACK_OAUTH_AUTHORIZE_URL ?? 'https://slack.com/oauth/v2/authorize';
  private readonly slackOAuthTokenUrl =
    process.env.SLACK_OAUTH_TOKEN_URL ?? 'https://slack.com/api/oauth.v2.access';
  private readonly gmailOAuthAuthorizeUrl =
    process.env.GMAIL_OAUTH_AUTHORIZE_URL ??
    process.env.GOOGLE_OAUTH_AUTHORIZE_URL ??
    'https://accounts.google.com/o/oauth2/v2/auth';
  private readonly gmailOAuthTokenUrl =
    process.env.GMAIL_OAUTH_TOKEN_URL ??
    process.env.GOOGLE_OAUTH_TOKEN_URL ??
    'https://oauth2.googleapis.com/token';

  constructor(
    private readonly prisma: PrismaService,
    private readonly pipelineService: PipelineService,
    private readonly queueService: JobQueueService
  ) { }

  async listConnectors(tenantId: string): Promise<
    Array<{
      id: string;
      provider: Provider;
      mode: string;
      lastSyncedAt: string | null;
      syncStatus: string | null;
      syncError: string | null;
      eventCount: number;
    }>
  > {
    const connectors = await this.prisma.connector.findMany({
      where: { tenantId },
      orderBy: { provider: 'asc' },
      include: {
        syncJobs: {
          orderBy: { createdAt: 'desc' },
          take: 1
        },
        _count: {
          select: { rawEvents: true }
        }
      }
    });

    return connectors.map((connector) => {
      const latestJob = connector.syncJobs[0];
      return {
        id: connector.id,
        provider: connector.provider,
        mode: connector.mode,
        lastSyncedAt: connector.lastSyncedAt?.toISOString() ?? null,
        syncStatus: latestJob?.status ?? null,
        syncError: latestJob?.error ?? null,
        eventCount: connector._count.rawEvents
      };
    });
  }

  getSlackOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI;
    const scopes =
      process.env.SLACK_READ_SCOPES ??
      'channels:read,channels:history,groups:read,groups:history';

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL(this.slackOAuthAuthorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('scope', scopes);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);

    return {
      url: url.toString(),
      state
    };
  }

  /**
   * Validates an OAuth state parameter to prevent CSRF / token-hijacking attacks.
   * Checks that (1) the tenantId embedded in state matches the JWT-derived tenantId,
   * and (2) the state was issued within the last 15 minutes.
   * Logs a security warning if no state is provided (allows existing flows to continue
   * working but records the absence for audit purposes).
   */
  private validateOAuthState(state: string | undefined, expectedTenantId: string): void {
    if (!state) {
      this.logger.warn(
        `[SECURITY] OAuth exchange called without state parameter for tenant ${expectedTenantId}. ` +
        `State validation skipped — pass the state returned by /oauth/start to fully protect against CSRF.`
      );
      return;
    }
    let parsed: { tenantId?: string; issuedAt?: string };
    try {
      parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
    } catch {
      throw new BadRequestException('Invalid OAuth state parameter: cannot decode.');
    }
    if (parsed.tenantId !== expectedTenantId) {
      throw new BadRequestException(
        'OAuth state validation failed: tenantId mismatch. Possible CSRF or token-hijacking attempt.'
      );
    }
    if (!parsed.issuedAt) {
      throw new BadRequestException('OAuth state validation failed: missing issuedAt.');
    }
    const ageMs = Date.now() - new Date(parsed.issuedAt).getTime();
    const maxAgeMs = 15 * 60 * 1000; // 15 minutes
    if (ageMs > maxAgeMs || ageMs < 0) {
      throw new BadRequestException(
        `OAuth state validation failed: state has expired (age ${Math.round(ageMs / 1000)}s). Start a new OAuth flow.`
      );
    }
  }

  async exchangeSlackOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{
    connectorId: string;
    provider: Provider;
    scope: string;
  }> {
    this.validateOAuthState(input.state, input.tenantId);

    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    const redirectUri = process.env.SLACK_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Slack OAuth token exchange is not configured. Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, and SLACK_REDIRECT_URI.'
      );
    }

    const response = await fetch(this.slackOAuthTokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Slack OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      error?: string;
      access_token?: string;
      refresh_token?: string;
      scope?: string;
    };

    if (!payload.ok || !payload.access_token) {
      throw new BadRequestException(
        `Slack OAuth token exchange failed: ${payload.error ?? 'missing_access_token'}`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'SLACK');

    await this.prisma.connector.update({
      where: {
        id: connector.id
      },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: payload.refresh_token ? encryptToken(payload.refresh_token) : null,
        checkpoint: {} as Prisma.InputJsonValue
      }
    });

    try {
      this.logger.log(`Auto-queueing initial sync for SLACK connector ${connector.id}`);
      await this.queueSync(input.tenantId, 'SLACK');
    } catch (err) {
      this.logger.error(`Failed to auto-queue initial sync for SLACK: ${(err as Error).message}`);
    }

    return {
      connectorId: connector.id,
      provider: 'SLACK',
      scope: payload.scope ?? ''
    };
  }

  getGmailOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GMAIL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI;
    const scopes =
      process.env.GMAIL_READ_SCOPES ?? 'https://www.googleapis.com/auth/gmail.readonly';

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Gmail OAuth is not configured. Set GMAIL_CLIENT_ID and GMAIL_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL(this.gmailOAuthAuthorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', scopes);
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return {
      url: url.toString(),
      state
    };
  }

  async exchangeGmailOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{
    connectorId: string;
    provider: Provider;
    scope: string;
  }> {
    this.validateOAuthState(input.state, input.tenantId);
    const clientId = process.env.GMAIL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Gmail OAuth token exchange is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.'
      );
    }

    const response = await fetch(this.gmailOAuthTokenUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Gmail OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!payload.access_token) {
      throw new BadRequestException(
        `Gmail OAuth token exchange failed: ${payload.error_description ?? payload.error ?? 'missing_access_token'
        }`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'GMAIL');

    await this.prisma.connector.update({
      where: {
        id: connector.id
      },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: payload.refresh_token ? encryptToken(payload.refresh_token) : null,
        checkpoint: {} as Prisma.InputJsonValue
      }
    });

    try {
      this.logger.log(`Auto-queueing initial sync for GMAIL connector ${connector.id}`);
      await this.queueSync(input.tenantId, 'GMAIL');
    } catch (err) {
      this.logger.error(`Failed to auto-queue initial sync for GMAIL: ${(err as Error).message}`);
    }

    return {
      connectorId: connector.id,
      provider: 'GMAIL',
      scope: payload.scope ?? ''
    };
  }

  // ── GitHub OAuth ──────────────────────────────────────────────────────────

  getGitHubOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.GITHUB_CLIENT_ID;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'GitHub OAuth is not configured. Set GITHUB_CLIENT_ID and GITHUB_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', process.env.GITHUB_SCOPES ?? 'repo read:user');
    url.searchParams.set('state', state);

    return { url: url.toString(), state };
  }

  async exchangeGitHubOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{ connectorId: string; provider: Provider; scope: string }> {
    this.validateOAuthState(input.state, input.tenantId);
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    const redirectUri = process.env.GITHUB_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'GitHub OAuth token exchange is not configured. Set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, and GITHUB_REDIRECT_URI.'
      );
    }

    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `GitHub OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      token_type?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!payload.access_token) {
      throw new BadRequestException(
        `GitHub OAuth token exchange failed: ${payload.error_description ?? payload.error ?? 'missing_access_token'}`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'GITHUB');

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: null,
        checkpoint: {} as Prisma.InputJsonValue
      }
    });

    return { connectorId: connector.id, provider: 'GITHUB', scope: payload.scope ?? '' };
  }

  // ── Notion OAuth ──────────────────────────────────────────────────────────

  getNotionOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.NOTION_CLIENT_ID;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Notion OAuth is not configured. Set NOTION_CLIENT_ID and NOTION_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL('https://api.notion.com/v1/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('owner', 'user');
    url.searchParams.set('state', state);

    return { url: url.toString(), state };
  }

  async exchangeNotionOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{ connectorId: string; provider: Provider }> {
    this.validateOAuthState(input.state, input.tenantId);
    const clientId = process.env.NOTION_CLIENT_ID;
    const clientSecret = process.env.NOTION_CLIENT_SECRET;
    const redirectUri = process.env.NOTION_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Notion OAuth token exchange is not configured. Set NOTION_CLIENT_ID, NOTION_CLIENT_SECRET, and NOTION_REDIRECT_URI.'
      );
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api.notion.com/v1/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${credentials}`,
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Notion OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      error?: string;
    };

    if (!payload.access_token) {
      throw new BadRequestException(
        `Notion OAuth token exchange failed: ${payload.error ?? 'missing_access_token'}`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'NOTION');

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: null,
        checkpoint: {} as Prisma.InputJsonValue
      }
    });

    return { connectorId: connector.id, provider: 'NOTION' };
  }

  // ── Linear OAuth ──────────────────────────────────────────────────────────

  getLinearOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.LINEAR_CLIENT_ID;
    const redirectUri = process.env.LINEAR_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Linear OAuth is not configured. Set LINEAR_CLIENT_ID and LINEAR_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL('https://linear.app/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', process.env.LINEAR_SCOPES ?? 'read');
    url.searchParams.set('state', state);

    return { url: url.toString(), state };
  }

  async exchangeLinearOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{ connectorId: string; provider: Provider; scope: string }> {
    this.validateOAuthState(input.state, input.tenantId);
    const clientId = process.env.LINEAR_CLIENT_ID;
    const clientSecret = process.env.LINEAR_CLIENT_SECRET;
    const redirectUri = process.env.LINEAR_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Linear OAuth token exchange is not configured. Set LINEAR_CLIENT_ID, LINEAR_CLIENT_SECRET, and LINEAR_REDIRECT_URI.'
      );
    }

    const response = await fetch('https://api.linear.app/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Linear OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      scope?: string;
      error?: string;
    };

    if (!payload.access_token) {
      throw new BadRequestException(
        `Linear OAuth token exchange failed: ${payload.error ?? 'missing_access_token'}`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'LINEAR');

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: null,
        checkpoint: {} as Prisma.InputJsonValue
      }
    });

    return { connectorId: connector.id, provider: 'LINEAR', scope: payload.scope ?? '' };
  }

  // ── Jira OAuth ────────────────────────────────────────────────────────────

  getJiraOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.JIRA_CLIENT_ID;
    const redirectUri = process.env.JIRA_REDIRECT_URI;

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Jira OAuth is not configured. Set JIRA_CLIENT_ID and JIRA_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL('https://auth.atlassian.com/authorize');
    url.searchParams.set('audience', 'api.atlassian.com');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      process.env.JIRA_SCOPES ?? 'read:jira-data read:jira-user offline_access'
    );
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'consent');

    return { url: url.toString(), state };
  }

  async exchangeJiraOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{ connectorId: string; provider: Provider; cloudId: string }> {
    this.validateOAuthState(input.state, input.tenantId);
    const clientId = process.env.JIRA_CLIENT_ID;
    const clientSecret = process.env.JIRA_CLIENT_SECRET;
    const redirectUri = process.env.JIRA_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Jira OAuth token exchange is not configured. Set JIRA_CLIENT_ID, JIRA_CLIENT_SECRET, and JIRA_REDIRECT_URI.'
      );
    }

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Jira OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };

    if (!payload.access_token) {
      throw new BadRequestException(
        `Jira OAuth token exchange failed: ${payload.error ?? 'missing_access_token'}`
      );
    }

    // Fetch the Atlassian cloudId for this token
    let cloudId: string;
    try {
      cloudId = await JiraReadOnlyConnector.fetchCloudId(payload.access_token);
    } catch (err) {
      throw new BadRequestException(
        `Could not resolve Jira cloud ID: ${(err as Error).message}`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'JIRA');

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: payload.refresh_token ? encryptToken(payload.refresh_token) : null,
        // Store cloudId in checkpoint so we can use it during sync
        checkpoint: { cloudId } as Prisma.InputJsonValue
      }
    });

    return { connectorId: connector.id, provider: 'JIRA', cloudId };
  }

  // ── Google Calendar OAuth ─────────────────────────────────────────────────

  getGCalOAuthStartUrl(tenantId: string): { url: string; state: string } {
    const clientId = process.env.GCAL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID;
    const redirectUri = process.env.GCAL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI;
    const authorizeUrl =
      process.env.GOOGLE_OAUTH_AUTHORIZE_URL ?? 'https://accounts.google.com/o/oauth2/v2/auth';

    if (!clientId || !redirectUri) {
      throw new BadRequestException(
        'Google Calendar OAuth is not configured. Set GCAL_CLIENT_ID (or GOOGLE_CLIENT_ID) and GCAL_REDIRECT_URI.'
      );
    }

    const state = Buffer.from(
      JSON.stringify({ tenantId, issuedAt: new Date().toISOString() })
    ).toString('base64url');

    const url = new URL(authorizeUrl);
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      process.env.GCAL_SCOPES ?? 'https://www.googleapis.com/auth/calendar.readonly'
    );
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('include_granted_scopes', 'true');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return { url: url.toString(), state };
  }

  async exchangeGCalOAuthCode(input: {
    tenantId: string;
    code: string;
    state?: string;
  }): Promise<{ connectorId: string; provider: Provider; scope: string }> {
    this.validateOAuthState(input.state, input.tenantId);
    const clientId = process.env.GCAL_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID ?? process.env.GMAIL_CLIENT_ID;
    const clientSecret =
      process.env.GCAL_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET ?? process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GCAL_REDIRECT_URI ?? process.env.GOOGLE_REDIRECT_URI;
    const tokenUrl = process.env.GOOGLE_OAUTH_TOKEN_URL ?? 'https://oauth2.googleapis.com/token';

    if (!clientId || !clientSecret || !redirectUri) {
      throw new BadRequestException(
        'Google Calendar OAuth token exchange is not configured.'
      );
    }

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: input.code,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Google Calendar OAuth token exchange failed with HTTP ${response.status}`
      );
    }

    const payload = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error?: string;
      error_description?: string;
    };

    if (!payload.access_token) {
      throw new BadRequestException(
        `Google Calendar OAuth token exchange failed: ${payload.error_description ?? payload.error ?? 'missing_access_token'}`
      );
    }

    await this.pipelineService.ensureTenant(input.tenantId);
    const connector = await this.pipelineService.ensureConnector(input.tenantId, 'GCAL');

    await this.prisma.connector.update({
      where: { id: connector.id },
      data: {
        accessToken: encryptToken(payload.access_token),
        refreshToken: payload.refresh_token ? encryptToken(payload.refresh_token) : null,
        checkpoint: {} as Prisma.InputJsonValue
      }
    });

    try {
      this.logger.log(`Auto-queueing initial sync for GCAL connector ${connector.id}`);
      await this.queueSync(input.tenantId, 'GCAL');
    } catch (err) {
      this.logger.error(`Failed to auto-queue initial sync for GCAL: ${(err as Error).message}`);
    }

    return { connectorId: connector.id, provider: 'GCAL', scope: payload.scope ?? '' };
  }

  // ── Disconnect ────────────────────────────────────────────────────────────

  async disconnectConnector(tenantId: string, provider: Provider): Promise<void> {
    const connector = await this.prisma.connector.findFirst({
      where: { tenantId, provider }
    });

    if (!connector) {
      throw new BadRequestException(`No ${provider} connector found`);
    }

    // Delete sync jobs first (foreign key)
    await this.prisma.syncJob.deleteMany({
      where: { connectorId: connector.id }
    });

    await this.prisma.connector.delete({
      where: { id: connector.id }
    });

    this.logger.log(`Disconnected ${provider} connector ${connector.id} for tenant ${tenantId}`);
  }

  async queueSync(tenantId: string, provider: Provider): Promise<{
    syncJobId: string;
    queueJobId: string;
    mode: 'QUEUED' | 'INLINE_FALLBACK';
  }> {
    await this.pipelineService.ensureTenant(tenantId);
    const connector = await this.pipelineService.ensureConnector(tenantId, provider);

    const syncJob = await this.prisma.syncJob.create({
      data: {
        tenantId,
        connectorId: connector.id,
        status: 'QUEUED'
      }
    });

    try {
      const queueJobId = await this.queueService.enqueueConnectorSync({
        tenantId,
        connectorId: connector.id,
        syncJobId: syncJob.id,
        provider
      });

      return {
        syncJobId: syncJob.id,
        queueJobId,
        mode: 'QUEUED'
      };
    } catch (error) {
      this.logger.warn(
        `Queue unavailable for provider ${provider}; running inline fallback. ${(error as Error).message}`
      );

      await this.prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'RUNNING',
          startedAt: new Date()
        }
      });

      try {
        await this.pipelineService.ingestProviderFixtures(tenantId, provider);
        await this.pipelineService.normalizeProviderEvents(tenantId, provider);

        await this.prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'SUCCEEDED',
            finishedAt: new Date(),
            error: null
          }
        });

        return {
          syncJobId: syncJob.id,
          queueJobId: `inline-${syncJob.id}`,
          mode: 'INLINE_FALLBACK'
        };
      } catch (syncError) {
        await this.prisma.syncJob.update({
          where: { id: syncJob.id },
          data: {
            status: 'FAILED',
            finishedAt: new Date(),
            error: (syncError as Error).message
          }
        });
        throw syncError;
      }
    }
  }

  async listSyncJobs(tenantId: string): Promise<
    Array<{ id: string; status: SyncJobStatus; provider: Provider; createdAt: string; error: string | null }>
  > {
    const jobs = await this.prisma.syncJob.findMany({
      where: {
        tenantId
      },
      include: {
        connector: {
          select: {
            provider: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 50
    });

    return jobs.map((job) => ({
      id: job.id,
      status: job.status,
      provider: job.connector.provider,
      createdAt: job.createdAt.toISOString(),
      error: job.error
    }));
  }
}
