import {
    Controller,
    Get,
    Post,
    Param,
    Body,
    UseGuards,
    Req,
    HttpCode,
    HttpStatus
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@prisma/client';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { PrismaService } from '../prisma/prisma.service';
import { OutcomeTrackerService } from '../ai/outcome-tracker.service';
import { AutomationService } from './automation.service';

/**
 * Agent Dashboard API — serves data for /agents and /agents/:id pages.
 * An "agent" is a deployed AutomationBlueprint with status=ACTIVE.
 */
@Controller('agents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AgentsController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly outcomeTracker: OutcomeTrackerService,
        private readonly automationService: AutomationService
    ) { }

    /**
     * List all deployed agents (active blueprints) with summary stats.
     */
    @Get()
    async listAgents(@Req() request: TenantRequest) {
        const { tenantId } = requireTenantContext(request);

        const blueprints = await this.prisma.automationBlueprint.findMany({
            where: { tenantId },
            include: {
                runs: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { id: true, status: true, createdAt: true, finishedAt: true }
                },
                _count: {
                    select: { runs: true }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        const agents = await Promise.all(
            blueprints.map(async (bp) => {
                const successRuns = await this.prisma.automationRun.count({
                    where: { blueprintId: bp.id, status: 'SUCCEEDED' }
                });
                const totalRuns = bp._count.runs;
                const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0;

                // Get time saved & cost metrics
                const outcomes = await this.outcomeTracker.getBlueprintOutcomes(tenantId, bp.id);

                // Determine current status
                const lastRun = bp.runs[0] ?? null;
                const currentStatus = bp.status !== 'ACTIVE' ? 'paused'
                    : lastRun?.status === 'RUNNING' ? 'running'
                        : lastRun?.status === 'FAILED' ? 'error'
                            : lastRun?.status === 'WAITING_HITL' ? 'awaiting_approval'
                                : 'idle';

                return {
                    id: bp.id,
                    name: bp.name,
                    description: bp.description,
                    workflowId: bp.workflowId,
                    status: bp.status,
                    currentStatus,
                    triggerType: bp.triggerType,
                    dryRun: bp.dryRun,
                    autoExecute: bp.autoExecute,
                    persona: bp.persona,
                    avatarUrl: bp.avatarUrl,
                    jobTitle: bp.jobTitle,
                    department: bp.department,
                    totalRuns,
                    successRate,
                    totalTimeSavedMinutes: outcomes.totalTimeSavedMinutes,
                    totalTimeSavedHours: outcomes.totalTimeSavedHours,
                    totalApiCostUsd: outcomes.metrics
                        .filter((m: any) => m.metricType === 'api_token_cost_usd')
                        .reduce((sum: number, m: any) => sum + m.currentValue, 0),
                    lastRunAt: lastRun?.createdAt ?? null,
                    lastRunStatus: lastRun?.status ?? null,
                    createdAt: bp.createdAt,
                    updatedAt: bp.updatedAt
                };
            })
        );

        return agents;
    }

    /**
     * Get detailed agent view with run history.
     */
    @Get(':id')
    async getAgent(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);

        const blueprint = await this.prisma.automationBlueprint.findFirst({
            where: { id, tenantId },
            include: {
                runs: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    select: {
                        id: true,
                        status: true,
                        triggeredBy: true,
                        dryRun: true,
                        stepResults: true,
                        logs: true,
                        startedAt: true,
                        finishedAt: true,
                        error: true,
                        createdAt: true
                    }
                },
                _count: { select: { runs: true } }
            }
        });

        if (!blueprint) {
            return { error: 'Agent not found', status: 404 };
        }

        const outcomes = await this.outcomeTracker.getBlueprintOutcomes(tenantId, id);
        const successRuns = await this.prisma.automationRun.count({
            where: { blueprintId: id, status: 'SUCCEEDED' }
        });

        const totalApiCost = outcomes.metrics
            .filter((m: any) => m.metricType === 'api_token_cost_usd')
            .reduce((sum: number, m: any) => sum + m.currentValue, 0);

        const totalNetSaving = outcomes.metrics
            .filter((m: any) => m.metricType === 'net_saving_usd')
            .reduce((sum: number, m: any) => sum + m.currentValue, 0);

        const lastRun = blueprint.runs[0] ?? null;
        const currentStatus = blueprint.status !== 'ACTIVE' ? 'paused'
            : lastRun?.status === 'RUNNING' ? 'running'
                : lastRun?.status === 'FAILED' ? 'error'
                    : lastRun?.status === 'WAITING_HITL' ? 'awaiting_approval'
                        : 'idle';

        return {
            id: blueprint.id,
            name: blueprint.name,
            description: blueprint.description,
            workflowId: blueprint.workflowId,
            status: blueprint.status,
            currentStatus,
            triggerType: blueprint.triggerType,
            triggerConfig: blueprint.triggerConfig,
            steps: blueprint.steps,
            dryRun: blueprint.dryRun,
            autoExecute: blueprint.autoExecute,
            confidenceThreshold: blueprint.confidenceThreshold,
            aiGenerated: blueprint.aiGenerated,
            aiReasoning: blueprint.aiReasoning,
            persona: blueprint.persona,
            avatarUrl: blueprint.avatarUrl,
            jobTitle: blueprint.jobTitle,
            department: blueprint.department,
            manager: blueprint.manager,
            totalRuns: blueprint._count.runs,
            successRate: blueprint._count.runs > 0 ? Math.round((successRuns / blueprint._count.runs) * 100) : 0,
            totalTimeSavedMinutes: outcomes.totalTimeSavedMinutes,
            totalTimeSavedHours: outcomes.totalTimeSavedHours,
            totalApiCostUsd: Number(totalApiCost.toFixed(4)),
            totalNetSavingUsd: Number(totalNetSaving.toFixed(2)),
            runs: blueprint.runs.map(run => ({
                ...run,
                durationMs: run.startedAt && run.finishedAt
                    ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
                    : null
            })),
            createdAt: blueprint.createdAt,
            updatedAt: blueprint.updatedAt
        };
    }

    /**
     * Pause an agent (set blueprint to PAUSED).
     */
    @Post(':id/pause')
    @Roles(UserRole.ADMIN, UserRole.ANALYST)
    @HttpCode(HttpStatus.OK)
    async pauseAgent(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);
        return this.automationService.updateBlueprint(tenantId, id, { status: 'PAUSED' } as any);
    }

    /**
     * Resume an agent (set blueprint to ACTIVE).
     */
    @Post(':id/resume')
    @Roles(UserRole.ADMIN, UserRole.ANALYST)
    @HttpCode(HttpStatus.OK)
    async resumeAgent(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);
        return this.automationService.updateBlueprint(tenantId, id, { status: 'ACTIVE' } as any);
    }

    /**
     * Force re-run / retrain the agent by queuing a new run.
     */
    @Post(':id/retrain')
    @Roles(UserRole.ADMIN, UserRole.ANALYST)
    @HttpCode(HttpStatus.OK)
    async retrainAgent(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId, actorId } = requireTenantContext(request);
        const run = await this.automationService.createRun(tenantId, id, actorId);
        this.automationService.executeRun(tenantId, run.id).catch(() => { });
        return { runId: run.id, status: 'QUEUED' };
    }

    /**
     * Update agent persona from dashboard
     */
    @Post(':id/persona')
    @Roles(UserRole.ADMIN, UserRole.ANALYST)
    @HttpCode(HttpStatus.OK)
    async updatePersona(@Req() request: TenantRequest, @Param('id') id: string, @Body('persona') persona: string) {
        const { tenantId } = requireTenantContext(request);
        return this.automationService.updateBlueprint(tenantId, id, { persona } as any);
    }

    /**
     * Get agent memories (semantic, episodic, working)
     */
    @Get(':id/memories')
    async getAgentMemories(@Req() request: TenantRequest, @Param('id') id: string) {
        const { tenantId } = requireTenantContext(request);
        const memories = await this.prisma.agentMemory.findMany({
            where: { tenantId, blueprintId: id },
            orderBy: { createdAt: 'desc' },
            take: 100 // limit to recent memories
        });

        return {
            semantic: memories.filter(m => m.type === 'SEMANTIC'),
            episodic: memories.filter(m => m.type === 'EPISODIC'),
            working: memories.filter(m => m.type === 'WORKING')
        };
    }
}
