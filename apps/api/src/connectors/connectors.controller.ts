import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Query,
  Res
} from '@nestjs/common';
import { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { Provider } from '@prisma/client';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { ConnectorsService } from './connectors.service';
import {
  GmailOAuthExchangeDto,
  GitHubOAuthExchangeDto,
  JiraOAuthExchangeDto,
  LinearOAuthExchangeDto,
  NotionOAuthExchangeDto,
  SlackOAuthExchangeDto,
  GCalOAuthExchangeDto
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
  constructor(private readonly connectorsService: ConnectorsService) { }

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

  @Public()
  @Get('slack/oauth/callback')
  async handleSlackOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3001';
    if (!code || !state) {
      return res.redirect(`${webUrl}/connectors?error=missing_oauth_params`);
    }

    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (!parsed.tenantId) throw new Error('Missing tenantId in state');

      await this.connectorsService.exchangeSlackOAuthCode({
        tenantId: parsed.tenantId,
        code,
        state
      });

      return res.redirect(`${webUrl}/connectors?success=true`);
    } catch (err) {
      return res.redirect(`${webUrl}/connectors?error=oauth_failed`);
    }
  }

  @Post('slack/oauth/exchange')
  async exchangeSlackOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: SlackOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeSlackOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code,
      state: dto.state
    });
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────

  @Get('gmail/oauth/start')
  getGmailOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getGmailOAuthStartUrl(tenantContext.tenantId);
  }

  @Public()
  @Get('gmail/oauth/callback')
  async handleGmailOAuthCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response
  ) {
    const webUrl = process.env.WEB_URL ?? 'http://localhost:3001';
    if (!code || !state) {
      return res.redirect(`${webUrl}/connectors?error=missing_oauth_params`);
    }

    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (!parsed.tenantId) throw new Error('Missing tenantId in state');

      await this.connectorsService.exchangeGmailOAuthCode({
        tenantId: parsed.tenantId,
        code,
        state
      });

      return res.redirect(`${webUrl}/connectors?success=true`);
    } catch (err) {
      return res.redirect(`${webUrl}/connectors?error=oauth_failed`);
    }
  }

  @Post('gmail/oauth/exchange')
  async exchangeGmailOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: GmailOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeGmailOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code,
      state: dto.state
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
      code: dto.code,
      state: dto.state
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
      code: dto.code,
      state: dto.state
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
      code: dto.code,
      state: dto.state
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
      code: dto.code,
      state: dto.state
    });
  }

  // ── Google Calendar ────────────────────────────────────────────────────────

  @Get('gcal/oauth/start')
  getGCalOAuthStart(@Req() request: TenantRequest): { url: string; state: string } {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.getGCalOAuthStartUrl(tenantContext.tenantId);
  }

  @Post('gcal/oauth/exchange')
  async exchangeGCalOAuthCode(
    @Req() request: TenantRequest,
    @Body() dto: GCalOAuthExchangeDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.connectorsService.exchangeGCalOAuthCode({
      tenantId: tenantContext.tenantId,
      code: dto.code,
      state: dto.state
    });
  }

  // ── Disconnect ─────────────────────────────────────────────────────────────

  @Delete(':provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disconnect(
    @Param('provider') providerInput: string,
    @Req() request: TenantRequest
  ): Promise<void> {
    const provider = parseProvider(providerInput);
    const tenantContext = requireTenantContext(request);
    await this.connectorsService.disconnectConnector(tenantContext.tenantId, provider);
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
