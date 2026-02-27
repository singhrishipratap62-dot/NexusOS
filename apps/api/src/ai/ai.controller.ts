import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
    HttpCode,
    HttpStatus,
    Logger
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { requireTenantContext, TenantRequest } from '../common/tenant-request';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { SYSTEM_PROMPTS } from './prompts';
import { BlueprintGeneratorService } from './blueprint-generator.service';
import { OutcomeTrackerService } from './outcome-tracker.service';

class ChatMessageDto {
    @IsString()
    message!: string;

    @IsString()
    @IsOptional()
    conversationId?: string;
}

class RefineBlueprintDto {
    @IsString()
    feedback!: string;
}

@Controller('ai')
export class AiController {
    private readonly logger = new Logger(AiController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly llm: LlmService,
        private readonly blueprintGenerator: BlueprintGeneratorService,
        private readonly outcomeTracker: OutcomeTrackerService
    ) { }

    /**
     * AI Chat — natural language interface to the Meta-Agent
     */
    @Post('chat')
    @HttpCode(HttpStatus.OK)
    async chat(@Req() request: TenantRequest, @Body() body: ChatMessageDto) {
        const { tenantId, actorId } = requireTenantContext(request);
        const conversationId = body.conversationId || `conv_${Date.now()}`;

        // Save user message
        await this.prisma.chatMessage.create({
            data: { tenantId, conversationId, role: 'user', content: body.message }
        });

        // Get recent conversation history
        const history = await this.prisma.chatMessage.findMany({
            where: { tenantId, conversationId },
            orderBy: { createdAt: 'asc' },
            take: 20
        });

        // Get context about the tenant's state
        const [workflows, blueprints, outcomes] = await Promise.all([
            this.prisma.workflow.findMany({
                where: { tenantId },
                select: { id: true, name: true, monthlyRuns: true, avgMinutesPerRun: true, aiAnalysis: true },
                take: 10
            }),
            this.prisma.automationBlueprint.findMany({
                where: { tenantId },
                select: { id: true, name: true, status: true, aiGenerated: true, persona: true },
                take: 10
            }),
            this.outcomeTracker.getTenantOutcomes(tenantId)
        ]);

        const contextBlock = `
TENANT CONTEXT:
- Workflows detected: ${workflows.length}
- Active blueprints: ${blueprints.length}
- Total automation runs: ${outcomes.totalRuns}
- Time saved: ${outcomes.totalTimeSavedHours} hours

WORKFLOWS: ${workflows.map(w => `"${w.name}" (${w.monthlyRuns} runs/mo, ${w.avgMinutesPerRun}min each${w.aiAnalysis ? ', AI-analyzed' : ''})`).join('; ')}

BLUEPRINTS: ${blueprints.map(b => `"${b.name}" (${b.status}${b.aiGenerated ? ', AI-generated' : ''}, Persona: ${b.persona || 'none'}, ID: ${b.id})`).join('; ')}
`;

        const historyMessages = history.map(h => `${h.role.toUpperCase()}: ${h.content}`).join('\n');

        let response: { message: string, action?: string | null, params?: Record<string, any> };

        try {
            const llmRes = await this.llm.completeJSON<{
                message: string;
                action?: string | null;
                params?: Record<string, any>;
            }>({
                systemPrompt: SYSTEM_PROMPTS.CHAT_RESPONSE + '\n\n' + contextBlock,
                userPrompt: `CONVERSATION HISTORY:\n${historyMessages}\n\nUSER: ${body.message}`
            });
            response = llmRes.data;
            this.logger.log(`[Chat] Received response from llm.completeJSON`);
        } catch (err: any) {
            this.logger.error(`[Chat] LLM call failed: ${err.message}`);
            response = {
                message: this.buildDeterministicReply(body.message, workflows, blueprints, outcomes)
            };
        }

        // Handle agent management actions directly in the backend
        if (response.action === 'retrain_agent' && response.params?.blueprintId) {
            await this.prisma.automationBlueprint.update({
                where: { id: response.params.blueprintId, tenantId },
                data: { persona: response.params.persona || null }
            });
            this.logger.log(`[Chat] Agent ${response.params.blueprintId} retrained.`);
            response.action = 'agent_retrained';
        } else if (response.action === 'pause_agent' && response.params?.blueprintId) {
            await this.prisma.automationBlueprint.update({
                where: { id: response.params.blueprintId, tenantId },
                data: { status: 'PAUSED' }
            });
            this.logger.log(`[Chat] Agent ${response.params.blueprintId} paused.`);
            response.action = 'agent_paused';
        } else if (response.action === 'resume_agent' && response.params?.blueprintId) {
            await this.prisma.automationBlueprint.update({
                where: { id: response.params.blueprintId, tenantId },
                data: { status: 'ACTIVE' }
            });
            this.logger.log(`[Chat] Agent ${response.params.blueprintId} resumed.`);
            response.action = 'agent_resumed';
        }

        // Save assistant reply
        await this.prisma.chatMessage.create({
            data: {
                tenantId,
                conversationId,
                role: 'assistant',
                content: response.message,
                metadata: response.action ? { action: response.action, params: response.params } as any : undefined
            }
        });

        return {
            conversationId,
            reply: response.message,
            action: response.action || null,
            params: response.params || null,
            source: this.llm.modelId
        };
    }

    /**
     * Generate a blueprint from a workflow
     */
    @Post('generate-blueprint/:workflowId')
    @HttpCode(HttpStatus.OK)
    async generateBlueprint(
        @Req() request: TenantRequest,
        @Param('workflowId') workflowId: string
    ) {
        const { tenantId, actorId } = requireTenantContext(request);
        return this.blueprintGenerator.generateBlueprint(tenantId, workflowId, actorId);
    }

    /**
     * Refine an existing blueprint with user feedback
     */
    @Post('refine-blueprint/:blueprintId')
    @HttpCode(HttpStatus.OK)
    async refineBlueprint(
        @Req() request: TenantRequest,
        @Param('blueprintId') blueprintId: string,
        @Body() body: RefineBlueprintDto
    ) {
        const { tenantId } = requireTenantContext(request);
        return this.blueprintGenerator.refineBlueprint(tenantId, blueprintId, body.feedback);
    }

    /**
     * Get conversation history
     */
    @Get('chat/:conversationId')
    async getChatHistory(
        @Req() request: TenantRequest,
        @Param('conversationId') conversationId: string
    ) {
        const { tenantId } = requireTenantContext(request);

        const messages = await this.prisma.chatMessage.findMany({
            where: { tenantId, conversationId },
            orderBy: { createdAt: 'asc' }
        });

        return { conversationId, messages };
    }

    /**
     * Get outcome metrics for a blueprint
     */
    @Get('outcomes/:blueprintId')
    async getOutcomes(
        @Req() request: TenantRequest,
        @Param('blueprintId') blueprintId: string
    ) {
        const { tenantId } = requireTenantContext(request);
        return this.outcomeTracker.getBlueprintOutcomes(tenantId, blueprintId);
    }

    /**
     * Get tenant-wide outcomes
     */
    @Get('outcomes')
    async getTenantOutcomes(@Req() request: TenantRequest) {
        const { tenantId } = requireTenantContext(request);
        return this.outcomeTracker.getTenantOutcomes(tenantId);
    }

    private buildDeterministicReply(
        message: string,
        workflows: any[],
        blueprints: any[],
        outcomes: any
    ): string {
        const lower = message.toLowerCase();

        if (lower.includes('opportunit') || lower.includes('workflow') || lower.includes('what should')) {
            if (workflows.length === 0) {
                return "You don't have any workflows detected yet. Connect a data source from the Connectors page and run an audit to discover workflow patterns.";
            }
            return `I found ${workflows.length} workflow(s): ${workflows.map(w => `**${w.name}** (${w.monthlyRuns} runs/mo)`).join(', ')}. Click "Analyze with AI" on any opportunity in the War Room to get a detailed breakdown.`;
        }

        if (lower.includes('agent') || lower.includes('automat') || lower.includes('blueprint')) {
            if (blueprints.length === 0) {
                return "No automation agents created yet. Analyze a workflow first, then click 'Generate Agent' to let me design one for you.";
            }
            return `You have ${blueprints.length} blueprint(s): ${blueprints.map(b => `**${b.name}** (${b.status})`).join(', ')}. Go to the Runs page to execute them.`;
        }

        if (lower.includes('save') || lower.includes('outcome') || lower.includes('result')) {
            return `So far, your automations have saved **${outcomes.totalTimeSavedHours} hours** across **${outcomes.totalRuns} runs**. ${outcomes.totalRuns === 0 ? 'Run some automation blueprints to start tracking outcomes.' : ''}`;
        }

        return `I can help you with:\n• **Analyzing workflows** — understand inefficiencies in your processes\n• **Generating agents** — auto-design automation blueprints\n• **Tracking outcomes** — see how much time you're saving\n\nTry asking: "What are my top automation opportunities?" or "Create an agent for my review process."`;
    }
}
