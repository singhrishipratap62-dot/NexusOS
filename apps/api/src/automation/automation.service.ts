import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AutomationBlueprint, AutomationRun, BlueprintStatus, TriggerType, AutomationStep } from '@nexus/contracts';
import { Prisma } from '@prisma/client';
import { StepExecutorService, StepResult } from './step-executor.service';
import { OutcomeTrackerService } from '../ai/outcome-tracker.service';
import { AgentReasoningService, StepReasoningTrace } from './agent-reasoning.service';
import { AgentMemoryService } from './agent-memory.service';

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stepExecutor: StepExecutorService,
    private readonly outcomeTracker: OutcomeTrackerService,
    private readonly agentReasoning: AgentReasoningService,
    private readonly agentMemory: AgentMemoryService
  ) { }

  async createBlueprint(
    tenantId: string,
    data: {
      name: string;
      description?: string;
      workflowId?: string;
      triggerType: TriggerType;
      triggerConfig?: Record<string, any>;
      steps: any[];
      dryRun?: boolean;
      createdById: string;
    }
  ): Promise<AutomationBlueprint> {
    if (data.triggerType === 'SCHEDULED' && !data.triggerConfig?.cron) {
      throw new BadRequestException('Scheduled triggers require a cron expression.');
    }

    const blueprint = await this.prisma.automationBlueprint.create({
      data: {
        tenantId,
        name: data.name,
        description: data.description,
        workflowId: data.workflowId,
        triggerType: data.triggerType,
        triggerConfig: data.triggerConfig as Prisma.InputJsonValue,
        steps: data.steps as Prisma.InputJsonValue,
        dryRun: data.dryRun ?? true,
        createdById: data.createdById,
        status: 'DRAFT'
      }
    });

    return blueprint as unknown as AutomationBlueprint;
  }

  async getBlueprint(tenantId: string, blueprintId: string): Promise<AutomationBlueprint> {
    const blueprint = await this.prisma.automationBlueprint.findUnique({
      where: { id: blueprintId, tenantId }
    });
    if (!blueprint) {
      throw new NotFoundException(`Blueprint with ID ${blueprintId} not found`);
    }
    return blueprint as unknown as AutomationBlueprint;
  }

  async listBlueprints(tenantId: string): Promise<AutomationBlueprint[]> {
    const blueprints = await this.prisma.automationBlueprint.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' }
    });
    return blueprints as unknown as AutomationBlueprint[];
  }

  async updateBlueprint(
    tenantId: string,
    blueprintId: string,
    data: Partial<Omit<AutomationBlueprint, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>>
  ): Promise<AutomationBlueprint> {
    await this.getBlueprint(tenantId, blueprintId);

    const updateData: any = { ...data };
    if (data.steps) updateData.steps = data.steps as unknown as Prisma.InputJsonValue;
    if (data.triggerConfig) updateData.triggerConfig = data.triggerConfig as Prisma.InputJsonValue;

    const updated = await this.prisma.automationBlueprint.update({
      where: { id: blueprintId },
      data: updateData
    });

    return updated as unknown as AutomationBlueprint;
  }

  async deleteBlueprint(tenantId: string, blueprintId: string): Promise<void> {
    await this.getBlueprint(tenantId, blueprintId);
    await this.prisma.automationBlueprint.delete({
      where: { id: blueprintId }
    });
  }

  async createRun(tenantId: string, blueprintId: string, triggeredBy: string): Promise<AutomationRun> {
    const blueprint = await this.getBlueprint(tenantId, blueprintId);

    const run = await this.prisma.automationRun.create({
      data: {
        tenantId,
        blueprintId,
        triggeredBy,
        dryRun: blueprint.dryRun,
        status: 'QUEUED'
      }
    });

    return run as unknown as AutomationRun;
  }

  /**
   * Check if this is the first run ever for a blueprint (for HITL enforcement).
   */
  private async isFirstRun(blueprintId: string): Promise<boolean> {
    const completedRuns = await this.prisma.automationRun.count({
      where: {
        blueprintId,
        status: 'SUCCEEDED'
      }
    });
    return completedRuns === 0;
  }

  /**
   * Execute a run with the autonomous agent reasoning engine.
   * For each step:
   *   1. The LLM reasons about whether to execute, modify, skip, or abort
   *   2. If first run of this blueprint, HITL pause before write-back steps
   *   3. Step results include reasoning traces and cost tracking
   */
  async executeRun(tenantId: string, runId: string): Promise<AutomationRun> {
    const run = await this.getRun(tenantId, runId);
    if (run.status !== 'QUEUED') {
      throw new BadRequestException(`Run ${runId} is not in QUEUED state (current: ${run.status})`);
    }

    const blueprint = await this.getBlueprint(tenantId, run.blueprintId);
    const steps = (blueprint.steps ?? []) as AutomationStep[];
    const logs: string[] = [];
    const reasoningTraces: StepReasoningTrace[] = [];
    let totalTokensUsed = 0;

    // Mark as RUNNING
    await this.prisma.automationRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date() }
    });

    logs.push(`[${new Date().toISOString()}] Run started${run.dryRun ? ' (DRY-RUN)' : ''}`);
    logs.push(`[${new Date().toISOString()}] Blueprint: ${blueprint.name} (${steps.length} steps)`);

    const firstRun = await this.isFirstRun(blueprint.id);
    if (firstRun) {
      logs.push(`[${new Date().toISOString()}] First run detected — HITL enforcement active for write-back steps`);
    }

    // Extract input context if this run is part of a chain
    let inputContext: any = null;
    const existingLogs = (run.logs as any[]) ?? [];
    const chainInputLog = existingLogs.find(l => l.type === 'chain_input');
    if (chainInputLog) {
      inputContext = chainInputLog.context;
      logs.push(`[${new Date().toISOString()}] Loaded input context from upstream chain node`);
    }

    const results: StepResult[] = [];
    let success = true;
    let hitlPaused = false;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Agent reasoning: ask the LLM before each step
      const decision = await this.agentReasoning.reasonAboutStep({
        tenantId,
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        persona: blueprint.persona,
        step,
        stepIndex: i,
        totalSteps: steps.length,
        previousResults: results.map(r => ({
          stepId: r.stepId,
          action: r.action,
          status: r.status,
          output: r.output
        })),
        inputContext
      });

      totalTokensUsed += decision.tokensUsed.total;
      logs.push(
        `[${new Date().toISOString()}] Agent reasoning for step ${step.id}: ${decision.action} — ${decision.reasoning}`
      );

      // Handle agent decisions
      if (decision.action === 'abort') {
        logs.push(`[${new Date().toISOString()}] Agent decided to ABORT: ${decision.reasoning}`);
        results.push({
          stepId: step.id,
          action: step.action,
          status: 'failed',
          output: { agentDecision: 'abort', reasoning: decision.reasoning },
          durationMs: decision.durationMs,
          error: `Agent aborted: ${decision.reasoning}`
        });
        success = false;
        break;
      }

      if (decision.action === 'skip') {
        logs.push(`[${new Date().toISOString()}] Agent decided to SKIP step ${step.id}: ${decision.reasoning}`);
        results.push({
          stepId: step.id,
          action: step.action,
          status: 'skipped',
          output: { agentDecision: 'skip', reasoning: decision.reasoning },
          durationMs: decision.durationMs
        });
        continue;
      }

      // Apply parameter modifications if the agent said so
      const effectiveStep: AutomationStep = decision.action === 'modify_params' && decision.modifiedParameters
        ? { ...step, parameters: { ...step.parameters, ...decision.modifiedParameters } }
        : step;

      // HITL enforcement for first run on write-back steps
      if (firstRun && !run.dryRun && this.isWriteBackStep(effectiveStep)) {
        logs.push(
          `[${new Date().toISOString()}] HITL pause: write-back step "${step.name ?? step.action}" requires approval (first run)`
        );

        // Save progress and pause
        await this.prisma.automationRun.update({
          where: { id: runId },
          data: {
            status: 'WAITING_HITL',
            stepResults: results as unknown as Prisma.InputJsonValue,
            logs: [
              ...logs,
              `[${new Date().toISOString()}] Waiting for approval on step ${i}: ${step.name ?? step.action}`,
              `[${new Date().toISOString()}] Agent reasoning: ${decision.reasoning}`,
              `[${new Date().toISOString()}] What will happen: ${effectiveStep.connectorId}.${effectiveStep.action}(${JSON.stringify(effectiveStep.parameters)})`
            ] as unknown as Prisma.InputJsonValue
          }
        });

        hitlPaused = true;
        break;
      }

      // Execute the step
      const stepResult = await this.stepExecutor.executeStep(effectiveStep, {
        tenantId,
        runId,
        dryRun: run.dryRun
      });

      results.push(stepResult);
      logs.push(
        `[${new Date().toISOString()}] Step ${stepResult.stepId}: ${stepResult.action} → ${stepResult.status} (${stepResult.durationMs}ms)${stepResult.error ? ' — ' + stepResult.error : ''}`
      );

      // Handle step failure with agent reasoning
      if (stepResult.status === 'failed') {
        const failureDecision = await this.agentReasoning.reasonAboutFailure({
          tenantId,
          blueprintId: blueprint.id,
          blueprintName: blueprint.name,
          persona: blueprint.persona,
          step: effectiveStep,
          error: stepResult.error ?? 'Unknown error',
          previousResults: results.map(r => ({
            stepId: r.stepId,
            action: r.action,
            status: r.status
          }))
        });

        totalTokensUsed += failureDecision.tokensUsed.total;
        logs.push(
          `[${new Date().toISOString()}] Agent failure reasoning: ${failureDecision.action} — ${failureDecision.reasoning}`
        );

        if (failureDecision.action === 'retry') {
          // Retry the step once
          const retryStep = failureDecision.modifiedParameters
            ? { ...effectiveStep, parameters: { ...effectiveStep.parameters, ...failureDecision.modifiedParameters } }
            : effectiveStep;

          const retryResult = await this.stepExecutor.executeStep(retryStep, {
            tenantId,
            runId,
            dryRun: run.dryRun
          });

          results.push(retryResult);
          logs.push(
            `[${new Date().toISOString()}] Retry step ${retryResult.stepId}: ${retryResult.action} → ${retryResult.status} (${retryResult.durationMs}ms)`
          );

          if (retryResult.status === 'failed') {
            success = false;
            break;
          }
        } else if (failureDecision.action === 'skip') {
          logs.push(`[${new Date().toISOString()}] Skipping failed step per agent reasoning`);
          continue;
        } else {
          // abort
          success = false;
          break;
        }
      }

      // Build reasoning trace
      reasoningTraces.push({
        stepId: step.id,
        preDecision: decision,
        totalTokensUsed: decision.tokensUsed.total,
        estimatedCostUsd: this.agentReasoning.estimateCost(decision.tokensUsed)
      });
    }

    if (hitlPaused) {
      return await this.getRun(tenantId, runId);
    }

    const finalStatus = success ? 'SUCCEEDED' : 'FAILED';
    const errorMsg = !success
      ? results.find((r) => r.status === 'failed')?.error ?? 'Unknown error'
      : null;

    const totalApiCost = reasoningTraces.reduce((sum, t) => sum + t.estimatedCostUsd, 0);
    logs.push(`[${new Date().toISOString()}] Run ${finalStatus.toLowerCase()}`);
    logs.push(`[${new Date().toISOString()}] Total tokens: ${totalTokensUsed}, est. cost: $${totalApiCost.toFixed(4)}`);

    // Update run record
    const updatedRun = await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        stepResults: results as unknown as Prisma.InputJsonValue,
        logs: logs as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
        error: errorMsg
      }
    });

    // Create audit event with enriched metadata
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: 'system',
        path: `/automation/runs/${runId}`,
        method: 'EXECUTE',
        action: 'automation_run_completed',
        metadata: {
          runId,
          blueprintId: blueprint.id,
          blueprintName: blueprint.name,
          status: finalStatus,
          dryRun: run.dryRun,
          stepsExecuted: results.length,
          totalDurationMs: results.reduce((sum, r) => sum + r.durationMs, 0),
          totalTokensUsed,
          estimatedApiCostUsd: totalApiCost,
          agentReasoningTraces: reasoningTraces.length
        } as Prisma.InputJsonValue
      }
    });

    // Record outcome metrics for successful runs (with cost)
    if (finalStatus === 'SUCCEEDED') {
      this.outcomeTracker.recordOutcome(tenantId, runId, blueprint.id, totalApiCost)
        .catch(err => this.logger.error(`Failed to record outcome for run ${runId}: ${err.message}`));
    }

    // Post-run memory management
    this.agentMemory.clearWorkingMemory(tenantId, blueprint.id)
      .catch(err => this.logger.error(`Failed to clear working memory for blueprint ${blueprint.id}: ${err.message}`));

    // Extract new semantic facts asynchronously
    this.agentMemory.extractSemanticFacts(tenantId, blueprint.id, logs)
      .catch(err => this.logger.error(`Failed to extract semantic facts for blueprint ${blueprint.id}: ${err.message}`));

    return updatedRun as unknown as AutomationRun;
  }

  /**
   * Check if a step performs a write-back operation (vs. read-only).
   */
  private isWriteBackStep(step: AutomationStep): boolean {
    const writeActions = [
      'slack_send_message', 'gmail_send_draft', 'gmail_send_email',
      'linear_create_issue', 'linear_update_status',
      'notion_create_page', 'github_create_issue', 'github_post_comment',
      'jira_create_issue'
    ];
    return writeActions.includes(step.action);
  }

  /**
   * Cancel a run that is QUEUED or RUNNING.
   */
  async cancelRun(tenantId: string, runId: string): Promise<AutomationRun> {
    const run = await this.getRun(tenantId, runId);

    if (run.status !== 'QUEUED' && run.status !== 'RUNNING') {
      throw new BadRequestException(
        `Run ${runId} cannot be cancelled (current status: ${run.status})`
      );
    }

    const updated = await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: 'CANCELLED',
        finishedAt: new Date(),
        error: 'Cancelled by user'
      }
    });

    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorId: 'user',
        path: `/automation/runs/${runId}/cancel`,
        method: 'POST',
        action: 'automation_run_cancelled',
        metadata: { runId, previousStatus: run.status } as Prisma.InputJsonValue
      }
    });

    this.logger.log(`Run ${runId} cancelled`);
    return updated as unknown as AutomationRun;
  }

  async listRuns(tenantId: string, blueprintId?: string): Promise<AutomationRun[]> {
    const where: Prisma.AutomationRunWhereInput = { tenantId };
    if (blueprintId) {
      where.blueprintId = blueprintId;
    }

    const runs = await this.prisma.automationRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return runs as unknown as AutomationRun[];
  }

  async getRun(tenantId: string, runId: string): Promise<AutomationRun> {
    const run = await this.prisma.automationRun.findUnique({
      where: { id: runId, tenantId }
    });

    if (!run) {
      throw new NotFoundException(`Run with ID ${runId} not found`);
    }

    return run as unknown as AutomationRun;
  }

  /**
   * Approve a HITL-paused step and resume execution.
   */
  async approveStep(tenantId: string, runId: string, stepIndex: number): Promise<AutomationRun> {
    const run = await this.getRun(tenantId, runId);

    if (run.status !== 'WAITING_HITL') {
      throw new BadRequestException(
        `Run ${runId} is not waiting for approval (current: ${run.status})`
      );
    }

    const blueprint = await this.getBlueprint(tenantId, run.blueprintId);
    const steps = (blueprint.steps ?? []) as AutomationStep[];

    if (stepIndex < 0 || stepIndex >= steps.length) {
      throw new BadRequestException(`Invalid step index: ${stepIndex}`);
    }

    // Mark as running again
    await this.prisma.automationRun.update({
      where: { id: runId },
      data: { status: 'RUNNING' }
    });

    const existingLogs = (run.logs ?? []) as string[];
    existingLogs.push(`[${new Date().toISOString()}] Step ${stepIndex} approved by user — resuming execution`);

    // Execute remaining steps from the approved step index
    const remainingSteps = steps.slice(stepIndex);
    const { results, success } = await this.stepExecutor.executeAllSteps(remainingSteps, {
      tenantId,
      runId,
      dryRun: run.dryRun
    });

    for (const result of results) {
      existingLogs.push(
        `[${new Date().toISOString()}] Step ${result.stepId}: ${result.action} → ${result.status} (${result.durationMs}ms)`
      );
    }

    const existingResults = (run.stepResults ?? []) as any[];
    const allResults = [...existingResults, ...results];
    const finalStatus = success ? 'SUCCEEDED' : 'FAILED';

    existingLogs.push(`[${new Date().toISOString()}] Run ${finalStatus.toLowerCase()} after approval`);

    const updatedRun = await this.prisma.automationRun.update({
      where: { id: runId },
      data: {
        status: finalStatus,
        stepResults: allResults as unknown as Prisma.InputJsonValue,
        logs: existingLogs as unknown as Prisma.InputJsonValue,
        finishedAt: new Date(),
        error: !success ? results.find(r => r.status === 'failed')?.error ?? null : null
      }
    });

    // Record outcome if successful
    if (finalStatus === 'SUCCEEDED') {
      this.outcomeTracker.recordOutcome(tenantId, runId, blueprint.id)
        .catch(err => this.logger.error(`Failed to record outcome for run ${runId}: ${err.message}`));
    }

    // Post-run memory management
    this.agentMemory.clearWorkingMemory(tenantId, blueprint.id)
      .catch(err => this.logger.error(`Failed to clear working memory for blueprint ${blueprint.id}: ${err.message}`));
    this.agentMemory.extractSemanticFacts(tenantId, blueprint.id, existingLogs)
      .catch(err => this.logger.error(`Failed to extract semantic facts for blueprint ${blueprint.id}: ${err.message}`));

    return updatedRun as unknown as AutomationRun;
  }
}
