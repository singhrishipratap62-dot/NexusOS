import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { Roles } from '../auth/roles.decorator';

class CreateTenantDto {
  @IsString()
  name!: string;
}

class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsIn(['ADMIN', 'ANALYST', 'VIEWER'])
  role?: 'ADMIN' | 'ANALYST' | 'VIEWER';
}


@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) { }

  @Get('me')
  async getCurrentTenant(@Req() request: TenantRequest) {
    const { tenantId } = requireTenantContext(request);
    return this.tenantsService.getTenant(tenantId);
  }

  @Get('me/members')
  async getMembers(@Req() request: TenantRequest) {
    const { tenantId } = requireTenantContext(request);
    return this.tenantsService.listMembers(tenantId);
  }

  @Post('me/invite')
  @Roles('ADMIN')
  async inviteMember(@Req() request: TenantRequest, @Body() body: InviteMemberDto) {
    const { tenantId } = requireTenantContext(request);
    return this.tenantsService.inviteMember(tenantId, body.email, body.role ?? 'VIEWER');
  }

  @Post('me/members/:userId/role')
  @Roles('ADMIN')
  async updateMemberRole(
    @Req() request: TenantRequest,
    @Param('userId') userId: string,
    @Body() body: { role: 'ADMIN' | 'ANALYST' | 'VIEWER' }
  ) {
    const { tenantId } = requireTenantContext(request);
    return this.tenantsService.updateMemberRole(tenantId, userId, body.role);
  }

  @Post()
  @Roles('ADMIN')
  async createTenant(@Req() request: TenantRequest, @Body() body: CreateTenantDto) {
    const { actorId } = requireTenantContext(request);
    return this.tenantsService.createTenant(body.name, actorId);
  }
}
