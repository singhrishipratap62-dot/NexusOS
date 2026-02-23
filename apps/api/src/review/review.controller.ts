import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { ReviewDecisionDto, ReviewQueueQueryDto } from './review.dto';
import { ReviewService } from './review.service';

@Controller('review-queue')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Get()
  async list(
    @Req() request: TenantRequest,
    @Query() query: ReviewQueueQueryDto
  ): Promise<unknown[]> {
    const tenantContext = requireTenantContext(request);
    return this.reviewService.listQueue(
      tenantContext.tenantId,
      query.includeResolved === 'true'
    );
  }

  @Post(':workflowId/decision')
  async decide(
    @Req() request: TenantRequest,
    @Param('workflowId') workflowId: string,
    @Body() dto: ReviewDecisionDto
  ): Promise<unknown> {
    const tenantContext = requireTenantContext(request);
    return this.reviewService.decide({
      tenantId: tenantContext.tenantId,
      workflowId,
      actorId: tenantContext.actorId,
      decision: dto.decision,
      reason: dto.reason
    });
  }
}
