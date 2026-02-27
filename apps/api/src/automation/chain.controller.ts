import { Controller, Get, Post, Put, Param, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { ChainOrchestratorService } from './chain-orchestrator.service';

@Controller('chains')
export class ChainController {
    constructor(private readonly chainService: ChainOrchestratorService) { }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    async createChain(@Req() request: TenantRequest, @Body() body: {
        name: string;
        description?: string;
        nodes: { blueprintId: string; triggerCondition: string; position: number; label?: string }[];
    }) {
        const { tenantId, actorId } = requireTenantContext(request);
        return this.chainService.createChain(tenantId, {
            ...body,
            createdById: actorId
        });
    }

    @Get()
    async listChains(@Req() request: TenantRequest) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.listChains(tenantId);
    }

    @Get(':id')
    async getChain(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.getChain(tenantId, id);
    }

    @Put(':id')
    async updateChain(@Req() request: TenantRequest, @Param('id') id: string, @Body() body: any) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.updateChain(tenantId, id, body);
    }

    @Post(':id/run')
    @HttpCode(HttpStatus.OK)
    async runChain(@Req() request: TenantRequest, @Param('id') id: string, @Body() body?: { inputContext?: any }) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.executeChain(tenantId, id, body?.inputContext);
    }

    @Post(':id/retry/:runId')
    @HttpCode(HttpStatus.OK)
    async retryChain(@Req() request: TenantRequest, @Param('runId') runId: string) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.retryChainFromFailure(tenantId, runId);
    }

    @Get(':id/runs')
    async getChainRuns(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.getChainRuns(tenantId, id);
    }

    @Get(':id/metrics')
    async getChainMetrics(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);
        return this.chainService.getChainMetrics(tenantId, id);
    }
}
