import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from './llm.service';
import { SYSTEM_PROMPTS, buildBlueprintPrompt } from './prompts';
import { Prisma } from '@prisma/client';

@Injectable()
export class BlueprintGeneratorService {
    private readonly logger = new Logger(BlueprintGeneratorService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly llm: LlmService
    ) { }

    /**
     * Generate an automation blueprint from a workflow using AI
     */
    async generateBlueprint(tenantId: string, workflowId: string, createdById: string) {
        const workflow = await this.prisma.workflow.findUnique({
            where: { id: workflowId, tenantId },
            include: { nodes: { orderBy: { sequence: 'asc' } } }
        });

        if (!workflow) {
            throw new Error('Workflow not found');
        }

        // Get connected providers for this tenant
        const connectors = await this.prisma.connector.findMany({
            where: { tenantId, accessToken: { not: null } },
            select: { provider: true }
        });
        const connectedProviders = connectors.map(c => c.provider.toLowerCase());

        // Get AI analysis if available
        const analysis = workflow.aiAnalysis as Record<string, any> | null;

        if (!this.llm.isAvailable) {
            // Deterministic fallback: generate a basic blueprint from workflow structure
            return this.generateDeterministicBlueprint(tenantId, workflow, connectedProviders, createdById);
        }

        const prompt = buildBlueprintPrompt({
            workflowName: workflow.name,
            inefficiency: analysis?.inefficiency ?? `Manual ${workflow.name} process across multiple tools`,
            recommendations: analysis?.recommendations ?? [],
            connectedProviders
        });

        const { data: blueprintData, meta } = await this.llm.completeJSON<{
            name: string;
            description: string;
            triggerType: string;
            triggerConfig: any;
            steps: any[];
            confidenceScore: number;
            reasoning: string;
        }>({
            systemPrompt: SYSTEM_PROMPTS.GENERATE_BLUEPRINT,
            userPrompt: prompt
        });

        // Create the blueprint
        const blueprint = await this.prisma.automationBlueprint.create({
            data: {
                tenantId,
                name: blueprintData.name || `AI Agent: ${workflow.name}`,
                description: blueprintData.description || null,
                workflowId,
                triggerType: (blueprintData.triggerType as any) || 'MANUAL',
                triggerConfig: blueprintData.triggerConfig as Prisma.InputJsonValue || undefined,
                steps: (blueprintData.steps || []) as Prisma.InputJsonValue,
                dryRun: true,
                autoExecute: false,
                confidenceThreshold: blueprintData.confidenceScore || 0.85,
                aiGenerated: true,
                aiReasoning: blueprintData.reasoning || null,
                createdById,
                status: 'DRAFT'
            }
        });

        this.logger.log(`AI generated blueprint ${blueprint.id} for workflow ${workflowId} (${meta.tokensUsed.total} tokens)`);

        return {
            blueprint,
            confidence: blueprintData.confidenceScore,
            reasoning: blueprintData.reasoning,
            source: meta.model,
            tokensUsed: meta.tokensUsed
        };
    }

    /**
     * Refine an existing blueprint using AI, incorporating user feedback
     */
    async refineBlueprint(tenantId: string, blueprintId: string, feedback: string) {
        const blueprint = await this.prisma.automationBlueprint.findUnique({
            where: { id: blueprintId, tenantId }
        });

        if (!blueprint) {
            throw new Error('Blueprint not found');
        }

        if (!this.llm.isAvailable) {
            return { blueprint, message: 'AI not available — please edit the blueprint manually' };
        }

        const currentSteps = JSON.stringify(blueprint.steps, null, 2);

        const { data: refined, meta } = await this.llm.completeJSON<{
            name: string;
            description: string;
            steps: any[];
            reasoning: string;
        }>({
            systemPrompt: SYSTEM_PROMPTS.GENERATE_BLUEPRINT,
            userPrompt: `Refine this existing automation blueprint based on user feedback:

CURRENT BLUEPRINT: "${blueprint.name}"
DESCRIPTION: ${blueprint.description || 'None'}
CURRENT STEPS:
${currentSteps}

USER FEEDBACK: "${feedback}"

Update the blueprint to incorporate the feedback. Keep existing steps that work well, modify or add steps based on the feedback.
Return the complete updated blueprint JSON.`
        });

        const updated = await this.prisma.automationBlueprint.update({
            where: { id: blueprintId },
            data: {
                name: refined.name || blueprint.name,
                description: refined.description || blueprint.description,
                steps: (refined.steps || blueprint.steps) as Prisma.InputJsonValue,
                aiReasoning: refined.reasoning || blueprint.aiReasoning
            }
        });

        return { blueprint: updated, reasoning: refined.reasoning, source: meta.model };
    }

    /**
     * Deterministic fallback when LLM is not available
     */
    private async generateDeterministicBlueprint(
        tenantId: string,
        workflow: any,
        connectedProviders: string[],
        createdById: string
    ) {
        const steps: any[] = [];
        let stepCounter = 1;

        // Generate notification steps based on connected providers
        if (connectedProviders.includes('slack')) {
            steps.push({
                id: `step_${stepCounter++}`,
                connectorId: 'slack',
                action: 'send_message',
                name: `Notify team about ${workflow.name}`,
                parameters: { channel: '#automation', text: `Workflow "${workflow.name}" has been triggered by NexusOS automation.` }
            });
        }

        if (connectedProviders.includes('linear')) {
            steps.push({
                id: `step_${stepCounter++}`,
                connectorId: 'linear',
                action: 'create_issue',
                name: `Track ${workflow.name} automation`,
                parameters: { teamId: 'default', title: `[NexusOS] ${workflow.name} automation run`, description: `Automated workflow run for ${workflow.name}`, priority: 2 }
            });
        }

        if (connectedProviders.includes('github')) {
            steps.push({
                id: `step_${stepCounter++}`,
                connectorId: 'github',
                action: 'create_issue',
                name: `Log ${workflow.name} activity`,
                parameters: { owner: 'org', repo: 'automation-log', title: `[NexusOS] ${workflow.name}`, body: `Automated workflow execution for: ${workflow.name}` }
            });
        }

        const blueprint = await this.prisma.automationBlueprint.create({
            data: {
                tenantId,
                name: `Auto-Agent: ${workflow.name}`,
                description: `AI-suggested automation for the "${workflow.name}" workflow. Running ${workflow.monthlyRuns} times/month, ~${workflow.avgMinutesPerRun} min each.`,
                workflowId: workflow.id,
                triggerType: 'MANUAL',
                steps: steps as Prisma.InputJsonValue,
                dryRun: true,
                autoExecute: false,
                aiGenerated: true,
                aiReasoning: 'Generated deterministically based on connected providers and workflow structure.',
                createdById,
                status: 'DRAFT'
            }
        });

        return {
            blueprint,
            confidence: 0.6,
            reasoning: 'Blueprint generated using deterministic rules (LLM not available).',
            source: 'deterministic'
        };
    }
}
