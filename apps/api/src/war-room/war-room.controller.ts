import { Controller, Get, Query, Req } from '@nestjs/common';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { WarRoomService } from './war-room.service';
import { WarRoomQueryDto } from './war-room.dto';

@Controller('war-room')
export class WarRoomController {
  constructor(private readonly warRoomService: WarRoomService) {}

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
}
