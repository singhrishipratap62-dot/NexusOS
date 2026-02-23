import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { Provider } from '@prisma/client';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { ConnectorsService } from './connectors.service';
import {
  GmailOAuthExchangeDto,
  GitHubOAuthExchangeDto,
  JiraOAuthExchangeDto,
  LinearOAuthExchangeDto,
  NotionOAuthExchangeDto,
  SlackOAuthExchangeDto
} from './connectors.dto';

const VALID_PROVIDERS = new Set<string>([
  'SLACK',
  'GMAIL',
  'GITHUB',
  'NOTION',
  'LINEAR',
  'JIRA',
  'GCAL'
]);

function parseProvider(input: string): Provider {
  const upper = input.toUpperCase();
  if (VALID_PROVIDERS.has(upper)) return upper as Provider;
  throw new BadRequestException(
    'Provider must be one of: SLACK, GMAIL, GITHUB, NOTION, LINEAR, JIRA, GCAL'
  );
}

@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly connectorsService: ConnectorsService) {}

  @Get()
  async list(@Req() request: TenantRequest): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.listConnectors(tenantContext.tenantId);
  }

  @Get('sync-jobs')
  async listSyncJobs(@Req() request: TenantRequest): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.listSyncJobs(tenantContext.tenantId);
  }

  // ── Slack ─────────────────────────────────────────────────────────────────

  @Get('slack/oauth/start')
  getSlackOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getSlackOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('slack/oauth/exchange')
  async exchangeSlackOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: SlackOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeSlackOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code
    });
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────

  @Get('gmail/oauth/start')
  getGmailOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getGmailOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('gmail/oauth/exchange')
  async exchangeGmailOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: GmailOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeGmailOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code
    });
  }

  // ── GitHub ────────────────────────────────────────────────────────────────

  @Get('github/oauth/start')
  getGitHubOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getGitHubOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('github/oauth/exchange')
  async exchangeGitHubOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: GitHubOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeGitHubOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code
    });
  }

  // ── Notion ────────────────────────────────────────────────────────────────

  @Get('notion/oauth/start')
  getNotionOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getNotionOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('notion/oauth/exchange')
  async exchangeNotionOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: NotionOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeNotionOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code
    });
  }

  // ── Linear ────────────────────────────────────────────────────────────────

  @Get('linear/oauth/start')
  getLinearOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getLinearOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('linear/oauth/exchange')
  async exchangeLinearOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: LinearOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeLinearOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code
    });
  }

  // ── Jira ──────────────────────────────────────────────────────────────────

  @Get('jira/oauth/start')
  getJiraOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getJiraOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('jira/oauth/exchange')
  async exchangeJiraOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: JiraOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeJiraOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code
    });
  }

  // ── Generic sync trigger ──────────────────────────────────────────────────

  @Post(':provider/sync')
  async triggerSync(
    @Param('provider') providerInput: string,
    @Req() request: TenantRequest
  ): Promise<unknown> {
    const provider = parseProvider(providerInput);
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.queueSync(tenantContext.tenantId, provider);
  }
}
