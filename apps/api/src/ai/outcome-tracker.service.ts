import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OutcomeTrackerService {
    private readonly logger = new Logger(OutcomeTrackerService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Record outcome metrics after a successful run
     */
    async recordOutcome(tenantId: string, runId: string, blueprintId: string, apiCostUsd: number = 0) {
        try {
            const run = await this.prisma.automationRun.findUnique({
                where: { id: runId },
                select: { status: true, stepResults: true, startedAt: true, finishedAt: true, dryRun: true }
            });

            if (!run || run.status !== 'SUCCEEDED') return;

            const stepResults = (run.stepResults as any[]) ?? [];
            const totalDurationMs = stepResults.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);
            const stepsExecuted = stepResults.filter(r => r.status === 'succeeded' || r.status === 'dry_run').length;

            // Record time saved metric
            const blueprint = await this.prisma.automationBlueprint.findUnique({
                where: { id: blueprintId },
                include: { runs: { where: { status: 'SUCCEEDED' }, select: { id: true } } }
            });

            if (!blueprint?.workflowId) return;

            const workflow = await this.prisma.workflow.findUnique({
                where: { id: blueprint.workflowId },
                select: { avgMinutesPerRun: true }
            });

            if (!workflow) return;

            const estimatedTimeSavedMinutes = workflow.avgMinutesPerRun * 0.6; // 60% automation coverage estimate
            const successRate = stepsExecuted / Math.max(1, stepResults.length);
            const blendedHourlyRate = Number(process.env.BLENDED_HOURLY_RATE ?? 95);
            const humanTimeCostUsd = (workflow.avgMinutesPerRun / 60) * blendedHourlyRate;
            const netSavingUsd = humanTimeCostUsd - apiCostUsd;

            // Record metrics
            await this.prisma.outcomeMetric.createMany({
                data: [
                    {
                        tenantId,
                        runId,
                        blueprintId,
                        metricType: 'time_saved_minutes',
                        baselineValue: workflow.avgMinutesPerRun,
                        currentValue: estimatedTimeSavedMinutes * successRate
                    },
                    {
                        tenantId,
                        runId,
                        blueprintId,
                        metricType: 'success_rate',
                        baselineValue: 1.0,
                        currentValue: successRate
                    },
                    {
                        tenantId,
                        runId,
                        blueprintId,
                        metricType: 'execution_time_ms',
                        baselineValue: workflow.avgMinutesPerRun * 60000,
                        currentValue: totalDurationMs
                    },
                    {
                        tenantId,
                        runId,
                        blueprintId,
                        metricType: 'api_token_cost_usd',
                        baselineValue: humanTimeCostUsd,
                        currentValue: apiCostUsd
                    },
                    {
                        tenantId,
                        runId,
                        blueprintId,
                        metricType: 'net_saving_usd',
                        baselineValue: humanTimeCostUsd,
                        currentValue: netSavingUsd
                    }
                ]
            });

            this.logger.log(
                `Recorded outcome for run ${runId}: ${estimatedTimeSavedMinutes.toFixed(1)}min saved, ` +
                `API cost $${apiCostUsd.toFixed(4)}, net saving $${netSavingUsd.toFixed(2)}`
            );
        } catch (err: any) {
            this.logger.warn(`Failed to record outcome for run ${runId}: ${err.message}`);
        }
    }

    /**
     * Get aggregated outcome metrics for a blueprint
     */
    async getBlueprintOutcomes(tenantId: string, blueprintId: string) {
        const metrics = await this.prisma.outcomeMetric.findMany({
            where: { tenantId, blueprintId },
            orderBy: { measuredAt: 'desc' }
        });

        const timeSaved = metrics.filter(m => m.metricType === 'time_saved_minutes');
        const successRates = metrics.filter(m => m.metricType === 'success_rate');

        const totalTimeSaved = timeSaved.reduce((sum, m) => sum + m.currentValue, 0);
        const avgSuccessRate = successRates.length > 0
            ? successRates.reduce((sum, m) => sum + m.currentValue, 0) / successRates.length
            : 0;
        const totalRuns = new Set(metrics.map(m => m.runId)).size;

        return {
            blueprintId,
            totalRuns,
            totalTimeSavedMinutes: Math.round(totalTimeSaved * 10) / 10,
            totalTimeSavedHours: Math.round(totalTimeSaved / 60 * 10) / 10,
            avgSuccessRate: Math.round(avgSuccessRate * 100),
            metrics: metrics.slice(0, 20) // last 20 metrics
        };
    }

    /**
     * Get overall tenant automation outcomes
     */
    async getTenantOutcomes(tenantId: string) {
        const metrics = await this.prisma.outcomeMetric.findMany({
            where: { tenantId },
            orderBy: { measuredAt: 'desc' },
            take: 100
        });

        const timeSaved = metrics.filter(m => m.metricType === 'time_saved_minutes');
        const totalTimeSaved = timeSaved.reduce((sum, m) => sum + m.currentValue, 0);
        const totalRuns = new Set(metrics.map(m => m.runId)).size;
        const uniqueBlueprints = new Set(metrics.map(m => m.blueprintId)).size;

        return {
            totalRuns,
            activeBlueprints: uniqueBlueprints,
            totalTimeSavedMinutes: Math.round(totalTimeSaved * 10) / 10,
            totalTimeSavedHours: Math.round(totalTimeSaved / 60 * 10) / 10,
            estimatedAnnualSavingsHours: Math.round(totalTimeSaved / 60 * 12 * 10) / 10
        };
    }
}
