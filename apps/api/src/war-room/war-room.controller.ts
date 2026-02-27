import { Controller, Get, Param, Post, Query, Req, Res, HttpCode, HttpStatus, Logger } from '@nestjs/common';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { WarRoomService } from './war-room.service';
import { WarRoomQueryDto } from './war-room.dto';
import { BlueprintGeneratorService } from '../ai/blueprint-generator.service';

@Controller('war-room')
export class WarRoomController {
  private readonly logger = new Logger(WarRoomController.name);

  constructor(
    private readonly warRoomService: WarRoomService,
    private readonly blueprintGenerator: BlueprintGeneratorService
  ) { }

  @Get('opportunities')
  async listOpportunities(
    @Req() request: TenantRequest,
    @Query() query: WarRoomQueryDto
  ): Promise<unknown> {
    const parsedLimit = Number(query.limit ?? 25);
    const tenantContext = requireTenantContext(request);

    return this.warRoomService.listOpportunities({
      tenantId: tenantContext.tenantId,
      includeNeedsReview: query.includeNeedsReview !== 'false',
      recommendationFilter: query.recommendation ?? 'ALL',
      reviewStatusFilter: query.reviewStatus ?? 'ALL',
      sortBy: query.sortBy ?? 'priority',
      sortDir: query.sortDir ?? 'desc',
      limit: Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 25
    });
  }

  @Get('executive-summary')
  async getExecutiveSummary(@Req() request: TenantRequest) {
    const { tenantId } = requireTenantContext(request);
    return this.warRoomService.getExecutiveSummary(tenantId);
  }

  @Get('bleed-map')
  async getBleedMap(@Req() request: TenantRequest) {
    const { tenantId } = requireTenantContext(request);
    return this.warRoomService.getBleedMap(tenantId);
  }

  @Get('ai-vs-human')
  async getAiVsHuman(@Req() request: TenantRequest) {
    const { tenantId } = requireTenantContext(request);
    return this.warRoomService.getAiVsHuman(tenantId);
  }

  @Get('workflow/:id')
  async getWorkflowDetail(@Req() request: TenantRequest, @Param('id') id: string) {
    const { tenantId } = requireTenantContext(request);
    return this.warRoomService.getWorkflowDetail(tenantId, id);
  }

  /**
   * One-click deploy: generate a blueprint for a workflow and return preview.
   */
  @Post('deploy-agent/:workflowId')
  @HttpCode(HttpStatus.OK)
  async deployAgent(@Req() request: TenantRequest, @Param('workflowId') workflowId: string) {
    const { tenantId, actorId } = requireTenantContext(request);
    const result = await this.blueprintGenerator.generateBlueprint(tenantId, workflowId, actorId);
    return result;
  }

  /**
   * Server-Sent Events endpoint for real-time War Room updates.
   * Clients connect to this and receive events when agents complete runs,
   * new workflows are detected, etc.
   */
  @Get('events')
  async sseEvents(@Req() request: TenantRequest, @Res() res: any) {
    const { tenantId } = requireTenantContext(request);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial heartbeat
    res.write(`data: ${JSON.stringify({ type: 'connected', tenantId })}\n\n`);

    // Poll for updates every 5 seconds
    const interval = setInterval(async () => {
      try {
        const summary = await this.warRoomService.getExecutiveSummary(tenantId);
        res.write(`data: ${JSON.stringify({ type: 'summary_update', ...summary })}\n\n`);
      } catch {
        // silent on error
      }
    }, 5000);

    // Clean up on close
    (request as any).on('close', () => {
      clearInterval(interval);
      this.logger.log(`SSE connection closed for tenant ${tenantId}`);
    });
  }
}
