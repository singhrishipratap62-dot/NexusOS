import {
    Controller,
    Get,
    Post,
    Param,
    Req,
    HttpCode,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { SYSTEM_PROMPTS, buildAnalyzePrompt, buildFeasibilityPrompt } from './prompts';

@Controller('ai')
export class AiAnalysisController {
    private readonly logger = new Logger(AiAnalysisController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly llm: LlmService
    ) { }

    /**
     * Analyze a specific workflow opportunity using AI
     */
    @Post('analyze/:workflowId')
    @HttpCode(HttpStatus.OK)
    async analyzeWorkflow(
        @Req() request: TenantRequest,
        @Param('workflowId') workflowId: string
    ) {
        const { tenantId } = requireTenantContext(request);

        const workflow = await this.prisma.workflow.findUnique({
            where: { id: workflowId, tenantId },
            include: { nodes: { orderBy: { sequence: 'asc' } } }
        });

        if (!workflow) {
            return { error: 'Workflow not found' };
        }

        // Get recent normalized events related to this workflow's tools
        const toolNames = workflow.nodes.map(n => n.tool);
        const events = await this.prisma.normalizedEvent.findMany({
            where: {
                tenantId,
                tool: { in: toolNames },
                occurredAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
            },
            orderBy: { occurredAt: 'desc' },
            take: 100,
            select: { actor: true, tool: true, action: true, occurredAt: true }
        });

        if (!this.llm.isAvailable) {
            // Fallback: generate a deterministic analysis
            const analysis = {
                inefficiency: `Repetitive ${workflow.name} process detected across ${workflow.nodes.length} steps`,
                rootCause: `Manual handoffs between ${toolNames.join(', ')} tools create delays and inconsistency`,
                impact: {
                    hoursWastedPerWeek: Math.round((workflow.avgMinutesPerRun * workflow.monthlyRuns) / 60 / 4),
                    affectedPeople: new Set(workflow.nodes.map(n => n.actor)).size,
                    severity: workflow.monthlyRuns > 20 ? 'high' : workflow.monthlyRuns > 5 ? 'medium' : 'low'
                },
                recommendations: [
                    {
                        action: `Automate the ${workflow.nodes[0]?.tool} → ${workflow.nodes[workflow.nodes.length - 1]?.tool} handoff`,
                        effort: 'medium',
                        expectedImprovement: `Save ~${Math.round(workflow.avgMinutesPerRun * 0.6)} minutes per run`
                    }
                ],
                summary: `This workflow runs ${workflow.monthlyRuns} times/month across ${toolNames.length} tools. Automating key handoffs could save significant time.`
            };

            await this.prisma.workflow.update({
                where: { id: workflowId },
                data: { aiAnalysis: analysis as any, aiAnalyzedAt: new Date() }
            });

            return { analysis, source: 'deterministic' };
        }

        // Use LLM for analysis
        const prompt = buildAnalyzePrompt({
            name: workflow.name,
            confidence: workflow.confidence,
            avgMinutesPerRun: workflow.avgMinutesPerRun,
            monthlyRuns: workflow.monthlyRuns,
            eventCount30d: workflow.eventCount30d,
            nodes: workflow.nodes.map(n => ({
                actor: n.actor, tool: n.tool, action: n.action, sequence: n.sequence
            })),
            events: events.map(e => ({
                actor: e.actor, tool: e.tool, action: e.action, occurredAt: e.occurredAt.toISOString()
            }))
        });

        const { data: analysis, meta } = await this.llm.completeJSON({
            systemPrompt: SYSTEM_PROMPTS.ANALYZE_WORKFLOW,
            userPrompt: prompt,
            fallback: {
                inefficiency: `Repetitive ${workflow.name} process with ${workflow.nodes.length} manual steps`,
                rootCause: 'Manual process spanning multiple tools',
                impact: { hoursWastedPerWeek: 0, affectedPeople: 0, severity: 'medium' },
                recommendations: [],
                summary: 'AI analysis unavailable — using fallback assessment'
            }
        });

        await this.prisma.workflow.update({
            where: { id: workflowId },
            data: { aiAnalysis: analysis as any, aiAnalyzedAt: new Date() }
        });

        this.logger.log(`AI analysis for workflow ${workflowId}: ${meta.tokensUsed.total} tokens, ${meta.durationMs}ms`);
        return { analysis, source: meta.model, tokensUsed: meta.tokensUsed };
    }

    /**
     * Get cached AI analysis for a workflow
     */
    @Get('analysis/:workflowId')
    async getAnalysis(
        @Req() request: TenantRequest,
        @Param('workflowId') workflowId: string
    ) {
        const { tenantId } = requireTenantContext(request);

        const workflow = await this.prisma.workflow.findUnique({
            where: { id: workflowId, tenantId },
            select: { id: true, name: true, aiAnalysis: true, aiAnalyzedAt: true }
        });

        if (!workflow) {
            return { error: 'Workflow not found' };
        }

        return {
            workflowId: workflow.id,
            workflowName: workflow.name,
            analysis: workflow.aiAnalysis,
            analyzedAt: workflow.aiAnalyzedAt,
            hasAnalysis: !!workflow.aiAnalysis
        };
    }

    /**
     * Batch analyze all unanalyzed workflows
     */
    @Post('analyze-all')
    @HttpCode(HttpStatus.OK)
    async analyzeAll(@Req() request: TenantRequest) {
        const { tenantId } = requireTenantContext(request);

        const workflows = await this.prisma.workflow.findMany({
            where: { tenantId, aiAnalyzedAt: null },
            select: { id: true }
        });

        const results: Array<{ workflowId: string; status: string }> = [];
        for (const wf of workflows) {
            try {
                await this.analyzeWorkflow(request, wf.id);
                results.push({ workflowId: wf.id, status: 'analyzed' });
            } catch (err: any) {
                results.push({ workflowId: wf.id, status: `error: ${err.message}` });
            }
        }

        return { analyzed: results.filter(r => r.status === 'analyzed').length, total: workflows.length, results };
    }

    /**
     * Check AI system status
     */
    @Get('status')
    async getAiStatus() {
        return {
            llmAvailable: this.llm.isAvailable,
            model: this.llm.isAvailable ? this.llm.modelId : 'none',
            mode: this.llm.isAvailable ? 'ai' : 'deterministic'
        };
    }
}
