import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AutomationService } from './automation.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { AutomationBlueprint, AutomationRun } from '@nexus/contracts';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';

@Controller('automation')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post('blueprints')
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  async createBlueprint(@Req() request: TenantRequest, @Body() body: any): Promise<AutomationBlueprint> {
    const { tenantId, actorId } = requireTenantContext(request);
    return this.automationService.createBlueprint(tenantId, { ...body, createdById: actorId });
  }

  @Get('blueprints')
  async listBlueprints(@Req() request: TenantRequest): Promise<AutomationBlueprint[]> {
    const { tenantId } = requireTenantContext(request);
    return this.automationService.listBlueprints(tenantId);
  }

  @Get('blueprints/:id')
  async getBlueprint(@Req() request: TenantRequest, @Param('id') id: string): Promise<AutomationBlueprint> {
    const { tenantId } = requireTenantContext(request);
    return this.automationService.getBlueprint(tenantId, id);
  }

  @Put('blueprints/:id')
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  async updateBlueprint(
    @Req() request: TenantRequest,
    @Param('id') id: string,
    @Body() body: Partial<AutomationBlueprint>
  ): Promise<AutomationBlueprint> {
    const { tenantId } = requireTenantContext(request);
    return this.automationService.updateBlueprint(tenantId, id, body);
  }

  @Delete('blueprints/:id')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBlueprint(@Req() request: TenantRequest, @Param('id') id: string): Promise<void> {
    const { tenantId } = requireTenantContext(request);
    await this.automationService.deleteBlueprint(tenantId, id);
  }

  @Post('blueprints/:id/run')
  @Roles(UserRole.ANALYST, UserRole.ADMIN)
  async runBlueprint(@Req() request: TenantRequest, @Param('id') id: string): Promise<AutomationRun> {
    const { tenantId, actorId } = requireTenantContext(request);
    return this.automationService.createRun(tenantId, id, actorId);
  }

  @Get('runs')
  async listRuns(@Req() request: TenantRequest): Promise<AutomationRun[]> {
    const { tenantId } = requireTenantContext(request);
    return this.automationService.listRuns(tenantId);
  }

  @Get('runs/:id')
  async getRun(@Req() request: TenantRequest, @Param('id') id: string): Promise<AutomationRun> {
    const { tenantId } = requireTenantContext(request);
    return this.automationService.getRun(tenantId, id);
  }
}
