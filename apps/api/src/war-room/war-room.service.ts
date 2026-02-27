import { Injectable } from '@nestjs/common';
import { RecommendationStatus } from '@prisma/client';
import { WarRoomOpportunity } from '@nexus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import {
  WarRoomRecommendationFilter,
  WarRoomReviewStatusFilter,
  WarRoomSortField
} from './war-room.dto';

const recommendationWeight: Record<RecommendationStatus, number> = {
  RECOMMENDED: 3,
  NEEDS_REVIEW: 2,
  NOT_RECOMMENDED: 1
};

function compareWithDirection(
  left: number,
  right: number,
  direction: 'asc' | 'desc'
): number {
  if (left === right) {
    return 0;
  }

  if (direction === 'asc') {
    return left < right ? -1 : 1;
  }

  return left > right ? -1 : 1;
}

function comparePrimarySort(
  left: WarRoomOpportunity,
  right: WarRoomOpportunity,
  sortBy: WarRoomSortField,
  sortDir: 'asc' | 'desc'
): number {
  if (sortBy === 'priority') {
    return compareWithDirection(
      recommendationWeight[left.recommendationStatus as RecommendationStatus],
      recommendationWeight[right.recommendationStatus as RecommendationStatus],
      sortDir
    );
  }

  if (sortBy === 'annualNetSavings') {
    return compareWithDirection(left.annualNetSavings, right.annualNetSavings, sortDir);
  }

  if (sortBy === 'roiScore') {
    return compareWithDirection(left.roiScore, right.roiScore, sortDir);
  }

  if (sortBy === 'feasibilityScore') {
    return compareWithDirection(left.feasibilityScore, right.feasibilityScore, sortDir);
  }

  if (sortBy === 'workflowConfidence') {
    return compareWithDirection(left.workflowConfidence, right.workflowConfidence, sortDir);
  }

  return compareWithDirection(left.annualLaborCost, right.annualLaborCost, sortDir);
}

@Injectable()
export class WarRoomService {
  constructor(private readonly prisma: PrismaService) { }

  async listOpportunities(input: {
    tenantId: string;
    includeNeedsReview: boolean;
    recommendationFilter: WarRoomRecommendationFilter;
    reviewStatusFilter: WarRoomReviewStatusFilter;
    sortBy: WarRoomSortField;
    sortDir: 'asc' | 'desc';
    limit: number;
  }): Promise<WarRoomOpportunity[]> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        tenantId: input.tenantId
      },
      include: {
        feasibility: true,
        roiSimulation: true,
        reviewItem: true
      }
    });

    const opportunities: WarRoomOpportunity[] = workflows
      .filter((workflow) => workflow.feasibility && workflow.roiSimulation && workflow.reviewItem)
      .map((workflow) => ({
        workflowId: workflow.id,
        workflowName: workflow.name,
        feasibilityScore: workflow.feasibility!.feasibilityScore,
        feasibilityConfidence: workflow.feasibility!.confidence,
        annualLaborCost: workflow.roiSimulation!.annualLaborCost,
        annualNetSavings: workflow.roiSimulation!.annualNetSavings,
        paybackMonths: workflow.roiSimulation!.paybackMonths,
        roiScore: workflow.roiSimulation!.roiScore,
        workflowConfidence: workflow.confidence,
        monthlyRuns: workflow.monthlyRuns,
        avgMinutesPerRun: workflow.avgMinutesPerRun,
        recommendationStatus: workflow.reviewItem!.recommendationStatus,
        reviewStatus: workflow.reviewItem!.reviewStatus
      }))
      .filter(
        (item) => input.includeNeedsReview || item.recommendationStatus !== 'NEEDS_REVIEW'
      )
      .filter((item) => {
        if (input.recommendationFilter === 'ALL') {
          return true;
        }
        return item.recommendationStatus === input.recommendationFilter;
      })
      .filter((item) => {
        if (input.reviewStatusFilter === 'ALL') {
          return true;
        }
        return item.reviewStatus === input.reviewStatusFilter;
      })
      .sort((a, b) => {
        const primarySort = comparePrimarySort(a, b, input.sortBy, input.sortDir);
        if (primarySort !== 0) {
          return primarySort;
        }

        if (b.annualNetSavings !== a.annualNetSavings) {
          return b.annualNetSavings - a.annualNetSavings;
        }

        if (b.roiScore !== a.roiScore) {
          return b.roiScore - a.roiScore;
        }

        if (b.workflowConfidence !== a.workflowConfidence) {
          return b.workflowConfidence - a.workflowConfidence;
        }

        if (b.feasibilityConfidence !== a.feasibilityConfidence) {
          return b.feasibilityConfidence - a.feasibilityConfidence;
        }

        if (a.reviewStatus !== b.reviewStatus) {
          const left = a.reviewStatus === 'PENDING_REVIEW' ? 1 : 0;
          const right = b.reviewStatus === 'PENDING_REVIEW' ? 1 : 0;
          return right - left;
        }

        return a.workflowName.localeCompare(b.workflowName);
      });

    return opportunities.slice(0, input.limit);
  }

  /**
   * Aggregate executive summary for the War Room dashboard.
   */
  async getExecutiveSummary(tenantId: string) {
    const [workflows, agents, outcomeMetrics, pendingReviews] = await Promise.all([
      this.prisma.workflow.findMany({
        where: { tenantId },
        include: { roiSimulation: true, hlcEstimate: true, reviewItem: true }
      }),
      this.prisma.automationBlueprint.findMany({
        where: { tenantId, status: 'ACTIVE' },
        include: { runs: { where: { status: 'SUCCEEDED' }, select: { id: true } } }
      }),
      this.prisma.outcomeMetric.findMany({
        where: { tenantId },
        orderBy: { measuredAt: 'desc' },
        take: 500
      }),
      this.prisma.reviewQueue.count({
        where: { tenantId, reviewStatus: 'PENDING_REVIEW' }
      })
    ]);

    // Total annual cost of unautomated workflows (sum of HLC)
    const totalAnnualManualCost = workflows
      .filter(w => w.hlcEstimate)
      .reduce((sum, w) => sum + (w.hlcEstimate?.annualLaborCost ?? 0), 0);

    // Total savings to date from deployed agents (sum of net_saving_usd metrics)
    const netSavings = outcomeMetrics.filter(m => m.metricType === 'net_saving_usd');
    const totalSavingsToDate = netSavings.reduce((sum, m) => sum + m.currentValue, 0);

    // Time saved
    const timeSaved = outcomeMetrics.filter(m => m.metricType === 'time_saved_minutes');
    const totalTimeSavedMinutes = timeSaved.reduce((sum, m) => sum + m.currentValue, 0);

    // Active agents with aggregate success rate
    const activeAgentCount = agents.length;
    const successRates = outcomeMetrics.filter(m => m.metricType === 'success_rate');
    const avgSuccessRate = successRates.length > 0
      ? Math.round((successRates.reduce((sum, m) => sum + m.currentValue, 0) / successRates.length) * 100)
      : 0;

    const totalAgentRuns = new Set(outcomeMetrics.map(m => m.runId)).size;

    // Biggest single saving opportunity
    const biggestOpportunity = workflows
      .filter(w => w.roiSimulation)
      .sort((a, b) => (b.roiSimulation?.annualLaborCost ?? 0) - (a.roiSimulation?.annualLaborCost ?? 0))[0];

    const activeChainCount = await this.prisma.agentChain.count({
      where: { tenantId, status: 'ACTIVE' }
    });

    return {
      totalAnnualManualCost: Math.round(totalAnnualManualCost),
      totalSavingsToDate: Math.round(totalSavingsToDate * 100) / 100,
      totalTimeSavedHours: Math.round(totalTimeSavedMinutes / 60 * 10) / 10,
      activeAgentCount,
      activeChainCount,
      avgSuccessRate,
      totalAgentRuns,
      pendingAutomation: pendingReviews,
      biggestOpportunity: biggestOpportunity ? {
        workflowId: biggestOpportunity.id,
        workflowName: biggestOpportunity.name,
        annualLaborCost: biggestOpportunity.roiSimulation?.annualLaborCost ?? 0,
        annualNetSavings: biggestOpportunity.roiSimulation?.annualNetSavings ?? 0
      } : null
    };
  }

  /**
   * Bleed Map: group workflows by source tool and workflow type with cost intensity.
   */
  async getBleedMap(tenantId: string) {
    const workflows = await this.prisma.workflow.findMany({
      where: { tenantId },
      include: {
        nodes: { orderBy: { sequence: 'asc' }, select: { tool: true, action: true } },
        hlcEstimate: true,
        roiSimulation: true
      }
    });

    // Group by primary tool (the most-used tool in the workflow nodes)
    const toolMap = new Map<string, { tool: string; totalCost: number; workflowCount: number; workflows: any[] }>();

    for (const wf of workflows) {
      if (!wf.hlcEstimate) continue;
      const cost = wf.hlcEstimate.annualLaborCost;

      // Determine primary tool from workflow nodes
      const toolCounts = new Map<string, number>();
      for (const node of wf.nodes) {
        toolCounts.set(node.tool, (toolCounts.get(node.tool) ?? 0) + 1);
      }
      const primaryTool = [...toolCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

      // Classify workflow type from aiAnalysis or name heuristics
      const analysis = wf.aiAnalysis as Record<string, any> | null;
      let workflowType = 'general';
      const nameLower = wf.name.toLowerCase();
      if (analysis?.workflowType) {
        workflowType = analysis.workflowType;
      } else if (nameLower.includes('standup') || nameLower.includes('meeting') || nameLower.includes('sync')) {
        workflowType = 'meetings';
      } else if (nameLower.includes('review') || nameLower.includes('pr') || nameLower.includes('code')) {
        workflowType = 'code-review';
      } else if (nameLower.includes('email') || nameLower.includes('message') || nameLower.includes('notify')) {
        workflowType = 'communication';
      } else if (nameLower.includes('report') || nameLower.includes('update') || nameLower.includes('status')) {
        workflowType = 'reporting';
      } else if (nameLower.includes('onboard') || nameLower.includes('admin') || nameLower.includes('setup')) {
        workflowType = 'admin';
      }

      if (!toolMap.has(primaryTool)) {
        toolMap.set(primaryTool, { tool: primaryTool, totalCost: 0, workflowCount: 0, workflows: [] });
      }
      const entry = toolMap.get(primaryTool)!;
      entry.totalCost += cost;
      entry.workflowCount += 1;
      entry.workflows.push({
        workflowId: wf.id,
        workflowName: wf.name,
        annualLaborCost: cost,
        workflowType,
        monthlyRuns: wf.monthlyRuns,
        avgMinutesPerRun: wf.avgMinutesPerRun
      });
    }

    const cells = [...toolMap.values()].sort((a, b) => b.totalCost - a.totalCost);
    const maxCost = cells[0]?.totalCost ?? 1;

    return {
      cells: cells.map(c => ({
        ...c,
        intensity: Math.round((c.totalCost / maxCost) * 100) // 0-100 intensity
      })),
      totalCost: cells.reduce((sum, c) => sum + c.totalCost, 0)
    };
  }

  /**
   * AI vs Human comparison for each deployed agent.
   */
  async getAiVsHuman(tenantId: string) {
    const agents = await this.prisma.automationBlueprint.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 50 }
      }
    });

    const blendedHourlyRate = Number(process.env.BLENDED_HOURLY_RATE ?? 95);
    const comparisons: any[] = [];

    for (const agent of agents) {
      if (!agent.workflowId) continue;

      const workflow = await this.prisma.workflow.findUnique({
        where: { id: agent.workflowId },
        select: { avgMinutesPerRun: true, monthlyRuns: true, name: true }
      });
      if (!workflow) continue;

      const metrics = await this.prisma.outcomeMetric.findMany({
        where: { tenantId, blueprintId: agent.id },
        orderBy: { measuredAt: 'desc' },
        take: 100
      });

      const successRates = metrics.filter(m => m.metricType === 'success_rate');
      const execTimes = metrics.filter(m => m.metricType === 'execution_time_ms');
      const apiCosts = metrics.filter(m => m.metricType === 'api_token_cost_usd');

      const avgAgentTimeMs = execTimes.length > 0
        ? execTimes.reduce((sum, m) => sum + m.currentValue, 0) / execTimes.length
        : 0;
      const avgAgentCostUsd = apiCosts.length > 0
        ? apiCosts.reduce((sum, m) => sum + m.currentValue, 0) / apiCosts.length
        : 0;
      const agentSuccessRate = successRates.length > 0
        ? successRates.reduce((sum, m) => sum + m.currentValue, 0) / successRates.length
        : 0;

      const humanTimeMinutes = workflow.avgMinutesPerRun;
      const humanCostPerTask = (humanTimeMinutes / 60) * blendedHourlyRate;
      const humanErrorRate = 0.04; // 4% assumed baseline

      const succeededRuns = agent.runs.filter(r => r.status === 'SUCCEEDED').length;
      const failedRuns = agent.runs.filter(r => r.status === 'FAILED').length;
      const todayRuns = agent.runs.filter(r => {
        const d = new Date(r.createdAt);
        const now = new Date();
        return d.toDateString() === now.toDateString();
      }).length;

      comparisons.push({
        agentId: agent.id,
        agentName: agent.name,
        workflowName: workflow.name,
        human: {
          timePerTask: `${humanTimeMinutes} min`,
          timePerTaskSeconds: humanTimeMinutes * 60,
          costPerTask: `$${humanCostPerTask.toFixed(2)}`,
          costPerTaskUsd: humanCostPerTask,
          tasksToday: Math.round(workflow.monthlyRuns / 30),
          errorRate: `${(humanErrorRate * 100).toFixed(1)}%`,
          errorRateValue: humanErrorRate
        },
        agent: {
          timePerTask: avgAgentTimeMs > 0 ? `${(avgAgentTimeMs / 1000).toFixed(1)}s` : 'N/A',
          timePerTaskSeconds: avgAgentTimeMs / 1000,
          costPerTask: avgAgentCostUsd > 0 ? `$${avgAgentCostUsd.toFixed(4)}` : 'N/A',
          costPerTaskUsd: avgAgentCostUsd,
          tasksToday: todayRuns,
          errorRate: `${((1 - agentSuccessRate) * 100).toFixed(1)}%`,
          errorRateValue: 1 - agentSuccessRate
        },
        totalRuns: succeededRuns + failedRuns,
        successRate: agentSuccessRate
      });
    }

    return comparisons;
  }

  /**
   * Get full workflow detail for the drawer view.
   */
  async getWorkflowDetail(tenantId: string, workflowId: string) {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId, tenantId },
      include: {
        nodes: { orderBy: { sequence: 'asc' } },
        edges: true,
        hlcEstimate: true,
        feasibility: true,
        roiSimulation: true,
        reviewItem: true
      }
    });

    if (!workflow) return null;

    // Check if already automated
    const blueprint = await this.prisma.automationBlueprint.findFirst({
      where: { tenantId, workflowId },
      include: {
        runs: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true, finishedAt: true } }
      }
    });

    // Get outcome metrics if automated
    let outcomes = null;
    if (blueprint) {
      const metrics = await this.prisma.outcomeMetric.findMany({
        where: { tenantId, blueprintId: blueprint.id },
        orderBy: { measuredAt: 'desc' },
        take: 20
      });
      const timeSaved = metrics.filter(m => m.metricType === 'time_saved_minutes');
      outcomes = {
        totalRuns: new Set(metrics.map(m => m.runId)).size,
        totalTimeSavedMinutes: timeSaved.reduce((sum, m) => sum + m.currentValue, 0),
        recentRuns: blueprint.runs
      };
    }

    return {
      id: workflow.id,
      name: workflow.name,
      confidence: workflow.confidence,
      monthlyRuns: workflow.monthlyRuns,
      avgMinutesPerRun: workflow.avgMinutesPerRun,
      aiAnalysis: workflow.aiAnalysis,
      nodes: workflow.nodes.map(n => ({
        id: n.id,
        actor: n.actor,
        tool: n.tool,
        action: n.action,
        sequence: n.sequence,
        confidence: n.confidence
      })),
      edges: workflow.edges.map(e => ({
        id: e.id,
        from: e.fromNodeId,
        to: e.toNodeId,
        confidence: e.confidence
      })),
      scoring: {
        hlcAnnualCost: workflow.hlcEstimate?.annualLaborCost ?? null,
        feasibilityScore: workflow.feasibility?.feasibilityScore ?? null,
        feasibilityConfidence: workflow.feasibility?.confidence ?? null,
        rationale: workflow.feasibility?.rationale ?? null,
        roiScore: workflow.roiSimulation?.roiScore ?? null,
        annualNetSavings: workflow.roiSimulation?.annualNetSavings ?? null,
        paybackMonths: workflow.roiSimulation?.paybackMonths ?? null,
        automationCoverage: workflow.roiSimulation?.automationCoverage ?? null
      },
      review: workflow.reviewItem ? {
        recommendationStatus: workflow.reviewItem.recommendationStatus,
        reviewStatus: workflow.reviewItem.reviewStatus,
        reason: workflow.reviewItem.reason
      } : null,
      automation: blueprint ? {
        blueprintId: blueprint.id,
        blueprintName: blueprint.name,
        status: blueprint.status,
        dryRun: blueprint.dryRun,
        outcomes
      } : null
    };
  }
}
