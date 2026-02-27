import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Provider, Prisma } from '@prisma/client';

/**
 * Trigger condition that a blueprint can be configured with.
 */
export interface TriggerCondition {
    eventType?: string;          // e.g. 'receive_email', 'message', 'recurring_meeting'
    provider?: string;           // e.g. 'SLACK', 'GMAIL', 'GCAL'
    channel?: string;            // channel name or ID filter
    subjectContains?: string;    // email subject keyword match
    actorContains?: string;      // actor name filter
    maxTriggersPerHour?: number; // frequency cap (default: 10)
}

/**
 * Result of evaluating triggers against new events.
 */
export interface TriggerMatch {
    blueprintId: string;
    blueprintName: string;
    matchedEventId: string;
    matchedEventAction: string;
    triggerCondition: TriggerCondition;
}

@Injectable()
export class TriggerEvaluatorService {
    private readonly logger = new Logger(TriggerEvaluatorService.name);
    private readonly DEFAULT_MAX_PER_HOUR = 10;

    constructor(private readonly prisma: PrismaService) { }

    /**
     * After a sync + normalization, evaluate whether any new events
     * match active blueprint trigger conditions. Returns enqueued runs.
     */
    async evaluateNewEvents(
        tenantId: string,
        provider: string,
        sinceTimestamp: Date
    ): Promise<TriggerMatch[]> {
        // Find active blueprints with EVENT trigger type
        const blueprints = await this.prisma.automationBlueprint.findMany({
            where: {
                tenantId,
                status: 'ACTIVE',
                triggerType: 'EVENT',
            },
            select: {
                id: true,
                name: true,
                triggerConfig: true,
                autoExecute: true,
                dryRun: true,
            }
        });

        if (blueprints.length === 0) {
            return [];
        }

        // Fetch new normalized events since last sync
        const newEvents = await this.prisma.normalizedEvent.findMany({
            where: {
                tenantId,
                provider: provider as Provider,
                occurredAt: { gte: sinceTimestamp },
                malformed: false
            },
            orderBy: { occurredAt: 'desc' },
            take: 100 // limit to prevent runaway
        });

        if (newEvents.length === 0) {
            return [];
        }

        const matches: TriggerMatch[] = [];

        for (const blueprint of blueprints) {
            const condition = (blueprint.triggerConfig ?? {}) as TriggerCondition;

            // Check frequency cap
            const maxPerHour = condition.maxTriggersPerHour ?? this.DEFAULT_MAX_PER_HOUR;
            const recentTriggerCount = await this.countRecentTriggers(tenantId, blueprint.id, 60);
            if (recentTriggerCount >= maxPerHour) {
                this.logger.warn(
                    `Blueprint ${blueprint.name} hit frequency cap (${recentTriggerCount}/${maxPerHour}/hr)`
                );
                continue;
            }

            // Match events against condition
            for (const event of newEvents) {
                if (this.matchesCondition(event, condition, provider)) {
                    // Enqueue a run
                    try {
                        const run = await this.prisma.automationRun.create({
                            data: {
                                tenantId,
                                blueprintId: blueprint.id,
                                triggeredBy: `event:${event.externalId}`,
                                dryRun: blueprint.dryRun,
                                status: 'QUEUED',
                                logs: [
                                    `[${new Date().toISOString()}] Auto-triggered by ${provider} event: ${event.action} (${event.externalId})`
                                ] as unknown as Prisma.InputJsonValue
                            }
                        });

                        // Log to audit_events
                        await this.prisma.auditEvent.create({
                            data: {
                                tenantId,
                                actorId: 'system-trigger',
                                path: `/automation/runs/${run.id}`,
                                method: 'TRIGGER',
                                action: 'agent_auto_triggered',
                                metadata: {
                                    blueprintId: blueprint.id,
                                    blueprintName: blueprint.name,
                                    runId: run.id,
                                    eventId: event.id,
                                    eventAction: event.action,
                                    provider,
                                    triggerCondition: JSON.parse(JSON.stringify(condition))
                                } as unknown as Prisma.InputJsonValue
                            }
                        });

                        matches.push({
                            blueprintId: blueprint.id,
                            blueprintName: blueprint.name,
                            matchedEventId: event.id,
                            matchedEventAction: event.action,
                            triggerCondition: condition
                        });

                        this.logger.log(
                            `Triggered blueprint "${blueprint.name}" from ${provider} event: ${event.action}`
                        );

                        // Only trigger once per blueprint per evaluation cycle
                        break;
                    } catch (err: any) {
                        this.logger.error(`Failed to create triggered run: ${err.message}`);
                    }
                }
            }
        }

        return matches;
    }

    /**
     * Match a normalized event against a blueprint's trigger condition.
     */
    private matchesCondition(
        event: { action: string; actor: string; channel: string | null; payload: any; provider: string },
        condition: TriggerCondition,
        currentProvider: string
    ): boolean {
        // Provider filter
        if (condition.provider && condition.provider !== currentProvider) {
            return false;
        }

        // Event type filter
        if (condition.eventType && event.action !== condition.eventType) {
            return false;
        }

        // Channel filter
        if (condition.channel) {
            const eventChannel = event.channel ?? '';
            if (!eventChannel.toLowerCase().includes(condition.channel.toLowerCase())) {
                return false;
            }
        }

        // Subject filter (check payload.source.subject for Gmail)
        if (condition.subjectContains) {
            const payload = event.payload as Record<string, any>;
            const subject = payload?.source?.subject ?? '';
            if (!subject.toLowerCase().includes(condition.subjectContains.toLowerCase())) {
                return false;
            }
        }

        // Actor filter
        if (condition.actorContains) {
            if (!event.actor.toLowerCase().includes(condition.actorContains.toLowerCase())) {
                return false;
            }
        }

        return true;
    }

    /**
     * Count how many runs were triggered for this blueprint in the last N minutes.
     */
    private async countRecentTriggers(
        tenantId: string,
        blueprintId: string,
        minutes: number
    ): Promise<number> {
        const since = new Date(Date.now() - minutes * 60 * 1000);
        return this.prisma.automationRun.count({
            where: {
                tenantId,
                blueprintId,
                createdAt: { gte: since },
                triggeredBy: { startsWith: 'event:' }
            }
        });
    }
}
