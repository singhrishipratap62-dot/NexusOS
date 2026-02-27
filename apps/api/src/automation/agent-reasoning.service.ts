import { Injectable, Logger } from '@nestjs/common';
import { AutomationStep } from '@nexus/contracts';
import { LlmService, LlmResponse } from '../ai/llm.service';
import { AgentMemoryService } from './agent-memory.service';

/**
 * Decision the LLM makes about each step before execution.
 */
export interface StepDecision {
    action: 'execute' | 'modify_params' | 'skip' | 'abort';
    reasoning: string;
    modifiedParameters?: Record<string, any>;
    tokensUsed: { prompt: number; completion: number; total: number };
    durationMs: number;
}

/**
 * Decision the LLM makes when a step fails.
 */
export interface FailureDecision {
    action: 'retry' | 'skip' | 'abort';
    reasoning: string;
    modifiedParameters?: Record<string, any>;
    tokensUsed: { prompt: number; completion: number; total: number };
}

/**
 * Full reasoning trace for a single step.
 */
export interface StepReasoningTrace {
    stepId: string;
    preDecision: StepDecision;
    postDecision?: FailureDecision;
    totalTokensUsed: number;
    estimatedCostUsd: number;
}

const COST_PER_1K_INPUT = 0.0003;   // typical API cost
const COST_PER_1K_OUTPUT = 0.0012;

const STEP_REASONING_SYSTEM_PROMPT = `You are the reasoning engine for an autonomous agent in NexusOS.
Before each automation step, you evaluate the step definition, the current execution context, 
and outputs from previous steps. You decide what to do.

CRITICAL RULES:
- If the step looks correct and the context supports it, respond with "execute".
- If parameters need adjustment based on context (e.g., previous step output changes a value), respond with "modify_params" and provide the new parameters.
- If the step is redundant or the context shows it's unnecessary, respond with "skip" and explain.
- If something is fundamentally wrong, respond with "abort" and explain.
- ALWAYS provide clear, specific reasoning.

Respond with JSON:
{
  "action": "execute" | "modify_params" | "skip" | "abort",
  "reasoning": "1-2 sentence explanation referencing specific data points",
  "modifiedParameters": { ... } // only if action is "modify_params"
}`;

const FAILURE_REASONING_SYSTEM_PROMPT = `You are the error-handling engine for an autonomous agent in NexusOS.
A step has failed during execution. Based on the error, step definition, and context, decide how to proceed.

- "retry": The error is transient (timeout, rate limit, network). The step should be retried.
- "skip": The step is non-critical and can be skipped without breaking the workflow.
- "abort": The error is fatal (auth failure, invalid params, missing resource). Stop the entire run.

Respond with JSON:
{
  "action": "retry" | "skip" | "abort",
  "reasoning": "1-2 sentence explanation",
  "modifiedParameters": { ... } // optional, if retry should use different params
}`;

@Injectable()
export class AgentReasoningService {
    private readonly logger = new Logger(AgentReasoningService.name);

    constructor(
        private readonly llm: LlmService,
        private readonly memoryService: AgentMemoryService
    ) { }

    /**
     * Before executing a step, ask the LLM to reason about it.
     * Falls back to "execute as-is" if the LLM is unavailable.
     */
    async reasonAboutStep(input: {
        tenantId: string;
        blueprintId: string;
        blueprintName: string;
        persona?: string | null;
        step: AutomationStep;
        stepIndex: number;
        totalSteps: number;
        previousResults: Array<{ stepId: string; action: string; status: string; output: Record<string, unknown> }>;
        triggerEvent?: Record<string, unknown>;
        inputContext?: any;
    }): Promise<StepDecision> {
        if (!this.llm.isAvailable) {
            return {
                action: 'execute',
                reasoning: 'LLM unavailable — executing step as defined (fallback mode)',
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                durationMs: 0
            };
        }

        // Fetch memories
        const memories = await this.memoryService.getRelevantMemories(input.tenantId, input.blueprintId);

        let systemPrompt = STEP_REASONING_SYSTEM_PROMPT;
        if (input.persona) {
            systemPrompt += `\n\nAGENT PERSONA:\n${input.persona}\nUse this persona to guide your tone and behavioral choices.`;
        }

        const userPrompt = `BLUEPRINT: "${input.blueprintName}"
STEP ${input.stepIndex + 1} OF ${input.totalSteps}:
  ID: ${input.step.id}
  Action: ${input.step.connectorId}.${input.step.action}
  Name: ${input.step.name ?? 'unnamed'}
  Parameters: ${JSON.stringify(input.step.parameters, null, 2)}

PREVIOUS STEP RESULTS:
${input.previousResults.length === 0 ? '  (none — this is the first step)' :
                input.previousResults.map(r => `  - ${r.stepId}: ${r.action} → ${r.status}`).join('\n')}

${input.triggerEvent ? `TRIGGER EVENT: ${JSON.stringify(input.triggerEvent, null, 2)}\n` : ''}
${input.inputContext ? `INPUT CONTEXT (From Upstream Agent): ${JSON.stringify(input.inputContext, null, 2)}\n` : ''}
SEMANTIC MEMORY (Facts/Rules):
${memories.semantic.length > 0 ? memories.semantic.map((m: string) => `- ${m}`).join('\n') : '  (none)'}

WORKING MEMORY (Current context):
${memories.working.length > 0 ? memories.working.map((m: string) => `- ${m}`).join('\n') : '  (none)'}

Should this step be executed, modified, skipped, or should the run be aborted?`;

        try {
            const { data, meta } = await this.llm.completeJSON<{
                action: 'execute' | 'modify_params' | 'skip' | 'abort';
                reasoning: string;
                modifiedParameters?: Record<string, any>;
            }>({
                systemPrompt,
                userPrompt,
                temperature: 0.1,
                fallback: { action: 'execute' as const, reasoning: 'Fallback: executing as defined' }
            });

            this.logger.log(
                `[Reasoning] Step ${input.step.id}: decision=${data.action} (${meta.durationMs}ms, ${meta.tokensUsed.total} tokens)`
            );

            return {
                action: data.action,
                reasoning: data.reasoning,
                modifiedParameters: data.modifiedParameters,
                tokensUsed: meta.tokensUsed,
                durationMs: meta.durationMs
            };
        } catch (err: any) {
            this.logger.warn(`Step reasoning failed — executing as defined: ${err.message}`);
            return {
                action: 'execute',
                reasoning: `Reasoning failed (${err.message}) — executing step as defined`,
                tokensUsed: { prompt: 0, completion: 0, total: 0 },
                durationMs: 0
            };
        }
    }

    /**
     * When a step fails, ask the LLM to reason about recovery.
     * Falls back to "abort" if the LLM is unavailable.
     */
    async reasonAboutFailure(input: {
        tenantId: string;
        blueprintId: string;
        blueprintName: string;
        persona?: string | null;
        step: AutomationStep;
        error: string;
        previousResults: Array<{ stepId: string; action: string; status: string }>;
    }): Promise<FailureDecision> {
        if (!this.llm.isAvailable) {
            return {
                action: 'abort',
                reasoning: 'LLM unavailable — aborting on failure (fallback mode)',
                tokensUsed: { prompt: 0, completion: 0, total: 0 }
            };
        }

        let systemPrompt = FAILURE_REASONING_SYSTEM_PROMPT;
        if (input.persona) {
            systemPrompt += `\n\nAGENT PERSONA:\n${input.persona}\nUse this persona to guide your error recovery behavior.`;
        }

        const userPrompt = `BLUEPRINT: "${input.blueprintName}"
FAILED STEP: ${input.step.id} (${input.step.connectorId}.${input.step.action})
ERROR: ${input.error}

PREVIOUS STEP RESULTS:
${input.previousResults.map(r => `  - ${r.stepId}: ${r.action} → ${r.status}`).join('\n')}

Should we retry this step, skip it, or abort the entire run?`;

        try {
            const { data, meta } = await this.llm.completeJSON<{
                action: 'retry' | 'skip' | 'abort';
                reasoning: string;
                modifiedParameters?: Record<string, any>;
            }>({
                systemPrompt,
                userPrompt,
                temperature: 0.1,
                fallback: { action: 'abort' as const, reasoning: 'Fallback: aborting on failure' }
            });

            return {
                action: data.action,
                reasoning: data.reasoning,
                modifiedParameters: data.modifiedParameters,
                tokensUsed: meta.tokensUsed
            };
        } catch (err: any) {
            return {
                action: 'abort',
                reasoning: `Failure reasoning failed (${err.message}) — aborting`,
                tokensUsed: { prompt: 0, completion: 0, total: 0 }
            };
        }
    }

    /**
     * Calculate the estimated API cost in USD.
     */
    estimateCost(tokensUsed: { prompt: number; completion: number }): number {
        return Number(
            (
                (tokensUsed.prompt / 1000) * COST_PER_1K_INPUT +
                (tokensUsed.completion / 1000) * COST_PER_1K_OUTPUT
            ).toFixed(6)
        );
    }
}
