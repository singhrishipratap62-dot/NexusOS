import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Provider, RecommendationStatus, ReviewStatus } from '@prisma/client';
import {
  buildRawEventHash,
  deriveRecommendationStatus,
  extractWorkflows,
  GitHubCheckpoint,
  GitHubReadOnlyConnector,
  GmailReadOnlyCheckpoint,
  GmailReadOnlyConnector,
  JiraCheckpoint,
  JiraReadOnlyConnector,
  LinearCheckpoint,
  LinearReadOnlyConnector,
  loadGitHubAuditFixtures,
  loadGmailAuditFixtures,
  loadJiraAuditFixtures,
  loadLinearAuditFixtures,
  loadNotionAuditFixtures,
  loadSlackAuditFixtures,
  NotionCheckpoint,
  NotionReadOnlyConnector,
  normalizeRawConnectorEvent,
  RawConnectorEvent,
  safeDecryptToken,
  SlackReadOnlyCheckpoint,
  SlackReadOnlyConnector,
  scoreHlcRoi
} from '@nexus/shared';
import { FeasibilityService } from '../scoring/feasibility.service';
import { PrismaService } from '../prisma/prisma.service';

function computeVarianceRatio(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) /
    Math.max(1, values.length - 1);

  const standardDeviation = Math.sqrt(variance);
  return Number((standardDeviation / Math.max(1, mean)).toFixed(4));
}

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly feasibilityService: FeasibilityService
  ) {}

  async ensureTenant(tenantId: string): Promise<void> {
    await this.prisma.tenant.upsert({
      where: { id: tenantId },
      update: {},
      create: {
        id: tenantId,
        name: 'NexusOS Day-1 Tenant'
      }
    });
  }

  async ensureConnector(
    tenantId: string,
    provider: Provider
  ): Promise<{ id: string; accessToken: string | null; checkpoint: Prisma.JsonValue | null }> {
    return this.prisma.connector.upsert({
      where: {
        tenantId_provider: {
          tenantId,
          provider
        }
      },
      update: {
        mode: 'READ_ONLY'
      },
      create: {
        tenantId,
        provider,
        mode: 'READ_ONLY'
      },
      select: {
        id: true,
        accessToken: true,
        checkpoint: true
      }
    });
  }

  private parseSlackCheckpoint(checkpoint: Prisma.JsonValue | null): SlackReadOnlyCheckpoint {
    if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
      return {};
    }

    return checkpoint as SlackReadOnlyCheckpoint;
  }

  private parseGmailCheckpoint(checkpoint: Prisma.JsonValue | null): GmailReadOnlyCheckpoint {
    if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
      return {};
    }

    return checkpoint as GmailReadOnlyCheckpoint;
  }

  private parseGenericCheckpoint<T extends object>(checkpoint: Prisma.JsonValue | null): T {
    if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
      return {} as T;
    }
    return checkpoint as unknown as T;
  }

  private async ingestSlackConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    accessToken: string;
    checkpoint: Prisma.JsonValue | null;
  }): Promise<{
    ingested: number;
    duplicates: number;
  }> {
    const channelIds = (process.env.SLACK_CHANNEL_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);

    const connector = new SlackReadOnlyConnector(input.accessToken, {
      maxRetries: Number(process.env.SLACK_MAX_RETRIES ?? 4),
      initialBackoffMs: Number(process.env.SLACK_BACKOFF_MS ?? 350)
    });

    const pullResult = await connector.pullMessages({
      checkpoint: this.parseSlackCheckpoint(input.checkpoint),
      channelIds: channelIds.length > 0 ? channelIds : undefined
    });

    let ingested = 0;
    let duplicates = 0;

    for (const event of pullResult.events) {
      const eventHash = buildRawEventHash({
        provider: 'SLACK',
        externalId: event.externalId,
        occurredAt: event.occurredAt,
        payload: event.payload
      });

      const existing = await this.prisma.rawEvent.findUnique({
        where: {
          tenantId_provider_eventHash: {
            tenantId: input.tenantId,
            provider: 'SLACK',
            eventHash
          }
        },
        select: {
          id: true
        }
      });

      if (existing) {
        duplicates += 1;
        continue;
      }

      await this.prisma.rawEvent.create({
        data: {
          tenantId: input.tenantId,
          connectorId: input.connectorId,
          provider: 'SLACK',
          externalId: event.externalId,
          eventHash,
          payload: event.payload as Prisma.InputJsonValue,
          occurredAt: new Date(event.occurredAt)
        }
      });

      ingested += 1;
    }

    await this.prisma.connector.update({
      where: {
        id: input.connectorId
      },
      data: {
        checkpoint: pullResult.checkpoint as unknown as Prisma.InputJsonValue,
        lastSyncedAt: new Date()
      }
    });

    return {
      ingested,
      duplicates
    };
  }

  private async ingestGmailConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    accessToken: string;
    checkpoint: Prisma.JsonValue | null;
  }): Promise<{
    ingested: number;
    duplicates: number;
  }> {
    const configuredPageSize = Number(process.env.GMAIL_PAGE_SIZE ?? 100);
    const pageSize =
      Number.isFinite(configuredPageSize) && configuredPageSize > 0
        ? Math.floor(configuredPageSize)
        : 100;

    const connector = new GmailReadOnlyConnector(input.accessToken, {
      maxRetries: Number(process.env.GMAIL_MAX_RETRIES ?? 4),
      initialBackoffMs: Number(process.env.GMAIL_BACKOFF_MS ?? 350)
    });

    let ingested = 0;
    let duplicates = 0;

    for await (const page of connector.pullMessagePages({
      checkpoint: this.parseGmailCheckpoint(input.checkpoint),
      pageSize,
      query: process.env.GMAIL_QUERY
    })) {
      for (const event of page.events) {
        const eventHash = buildRawEventHash({
          provider: 'GMAIL',
          externalId: event.externalId,
          occurredAt: event.occurredAt,
          payload: event.payload
        });

        const existing = await this.prisma.rawEvent.findUnique({
          where: {
            tenantId_provider_eventHash: {
              tenantId: input.tenantId,
              provider: 'GMAIL',
              eventHash
            }
          },
          select: {
            id: true
          }
        });

        if (existing) {
          duplicates += 1;
          continue;
        }

        await this.prisma.rawEvent.create({
          data: {
            tenantId: input.tenantId,
            connectorId: input.connectorId,
            provider: 'GMAIL',
            externalId: event.externalId,
            eventHash,
            payload: event.payload as Prisma.InputJsonValue,
            occurredAt: new Date(event.occurredAt)
          }
        });

        ingested += 1;
      }

      await this.prisma.connector.update({
        where: {
          id: input.connectorId
        },
        data: {
          checkpoint: page.checkpoint as unknown as Prisma.InputJsonValue,
          ...(page.checkpoint.nextPageToken ? {} : { lastSyncedAt: new Date() })
        }
      });
    }

    return {
      ingested,
      duplicates
    };
  }

  private async ingestGenericConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    provider: Provider;
    events: RawConnectorEvent[];
    newCheckpoint: Prisma.InputJsonValue;
  }): Promise<{ ingested: number; duplicates: number }> {
    let ingested = 0;
    let duplicates = 0;

    for (const event of input.events) {
      const eventHash = buildRawEventHash({
        provider: input.provider,
        externalId: event.externalId,
        occurredAt: event.occurredAt,
        payload: event.payload
      });

      const existing = await this.prisma.rawEvent.findUnique({
        where: {
          tenantId_provider_eventHash: {
            tenantId: input.tenantId,
            provider: input.provider,
            eventHash
          }
        },
        select: { id: true }
      });

      if (existing) {
        duplicates += 1;
        continue;
      }

      await this.prisma.rawEvent.create({
        data: {
          tenantId: input.tenantId,
          connectorId: input.connectorId,
          provider: input.provider,
          externalId: event.externalId,
          eventHash,
          payload: event.payload as Prisma.InputJsonValue,
          occurredAt: new Date(event.occurredAt)
        }
      });

      ingested += 1;
    }

    await this.prisma.connector.update({
      where: { id: input.connectorId },
      data: { checkpoint: input.newCheckpoint, lastSyncedAt: new Date() }
    });

    return { ingested, duplicates };
  }

  private async ingestGitHubConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    accessToken: string;
    checkpoint: Prisma.JsonValue | null;
  }): Promise<{ ingested: number; duplicates: number }> {
    const cp = this.parseGenericCheckpoint<GitHubCheckpoint>(input.checkpoint);
    const repos = (process.env.GITHUB_REPOS ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const connector = new GitHubReadOnlyConnector(input.accessToken, {
      maxRetries: Number(process.env.GITHUB_MAX_RETRIES ?? 4)
    });

    const result = await connector.pullIssues({ checkpoint: cp, repos: repos.length ? repos : undefined });

    const events: RawConnectorEvent[] = result.events.map((e) => ({
      provider: 'GITHUB' as Provider,
      externalId: e.externalId,
      occurredAt: e.occurredAt,
      actor: e.actor,
      channel: e.channel,
      payload: e.payload
    }));

    return this.ingestGenericConnectorEvents({
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      provider: 'GITHUB',
      events,
      newCheckpoint: result.checkpoint as unknown as Prisma.InputJsonValue
    });
  }

  private async ingestNotionConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    accessToken: string;
    checkpoint: Prisma.JsonValue | null;
  }): Promise<{ ingested: number; duplicates: number }> {
    const cp = this.parseGenericCheckpoint<NotionCheckpoint>(input.checkpoint);
    const connector = new NotionReadOnlyConnector(input.accessToken, {
      maxRetries: Number(process.env.NOTION_MAX_RETRIES ?? 4)
    });

    const result = await connector.pullPages({ checkpoint: cp });

    const events: RawConnectorEvent[] = result.events.map((e) => ({
      provider: 'NOTION' as Provider,
      externalId: e.externalId,
      occurredAt: e.occurredAt,
      actor: e.actor,
      payload: e.payload
    }));

    return this.ingestGenericConnectorEvents({
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      provider: 'NOTION',
      events,
      newCheckpoint: result.checkpoint as unknown as Prisma.InputJsonValue
    });
  }

  private async ingestLinearConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    accessToken: string;
    checkpoint: Prisma.JsonValue | null;
  }): Promise<{ ingested: number; duplicates: number }> {
    const cp = this.parseGenericCheckpoint<LinearCheckpoint>(input.checkpoint);
    const connector = new LinearReadOnlyConnector(input.accessToken, {
      maxRetries: Number(process.env.LINEAR_MAX_RETRIES ?? 4)
    });

    const result = await connector.pullIssues({ checkpoint: cp });

    const events: RawConnectorEvent[] = result.events.map((e) => ({
      provider: 'LINEAR' as Provider,
      externalId: e.externalId,
      occurredAt: e.occurredAt,
      actor: e.actor,
      channel: e.channel,
      payload: e.payload
    }));

    return this.ingestGenericConnectorEvents({
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      provider: 'LINEAR',
      events,
      newCheckpoint: result.checkpoint as unknown as Prisma.InputJsonValue
    });
  }

  private async ingestJiraConnectorEvents(input: {
    tenantId: string;
    connectorId: string;
    accessToken: string;
    checkpoint: Prisma.JsonValue | null;
  }): Promise<{ ingested: number; duplicates: number }> {
    const cp = this.parseGenericCheckpoint<JiraCheckpoint>(input.checkpoint);

    // cloudId is stored in the checkpoint from the OAuth exchange
    const storedCheckpoint = this.parseGenericCheckpoint<{ cloudId?: string } & JiraCheckpoint>(
      input.checkpoint
    );
    const cloudId = storedCheckpoint.cloudId ?? process.env.JIRA_CLOUD_ID ?? '';

    if (!cloudId) {
      throw new Error('Jira cloudId not found. Complete OAuth first or set JIRA_CLOUD_ID env var.');
    }

    const connector = new JiraReadOnlyConnector(input.accessToken, cloudId, {
      maxRetries: Number(process.env.JIRA_MAX_RETRIES ?? 4)
    });

    const result = await connector.pullIssues({ checkpoint: cp });

    const events: RawConnectorEvent[] = result.events.map((e) => ({
      provider: 'JIRA' as Provider,
      externalId: e.externalId,
      occurredAt: e.occurredAt,
      actor: e.actor,
      channel: e.channel,
      payload: e.payload
    }));

    return this.ingestGenericConnectorEvents({
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      provider: 'JIRA',
      events,
      newCheckpoint: { ...result.checkpoint, cloudId } as unknown as Prisma.InputJsonValue
    });
  }

  private selectFixtureLoader(provider: Provider): RawConnectorEvent[] {
    switch (provider) {
      case 'SLACK': return loadSlackAuditFixtures();
      case 'GMAIL': return loadGmailAuditFixtures();
      case 'GITHUB': return loadGitHubAuditFixtures();
      case 'NOTION': return loadNotionAuditFixtures();
      case 'LINEAR': return loadLinearAuditFixtures();
      case 'JIRA': return loadJiraAuditFixtures();
      default: return [];
    }
  }

  async ingestProviderFixtures(tenantId: string, provider: Provider): Promise<{
    ingested: number;
    duplicates: number;
  }> {
    await this.ensureTenant(tenantId);
    const connector = await this.ensureConnector(tenantId, provider);

    const decryptedToken = safeDecryptToken(connector.accessToken);

    if (provider === 'SLACK' && decryptedToken) {
      return this.ingestSlackConnectorEvents({
        tenantId,
        connectorId: connector.id,
        accessToken: decryptedToken,
        checkpoint: connector.checkpoint
      });
    }

    if (provider === 'GMAIL' && decryptedToken) {
      return this.ingestGmailConnectorEvents({
        tenantId,
        connectorId: connector.id,
        accessToken: decryptedToken,
        checkpoint: connector.checkpoint
      });
    }

    if (provider === 'GITHUB' && decryptedToken) {
      return this.ingestGitHubConnectorEvents({
        tenantId,
        connectorId: connector.id,
        accessToken: decryptedToken,
        checkpoint: connector.checkpoint
      });
    }

    if (provider === 'NOTION' && decryptedToken) {
      return this.ingestNotionConnectorEvents({
        tenantId,
        connectorId: connector.id,
        accessToken: decryptedToken,
        checkpoint: connector.checkpoint
      });
    }

    if (provider === 'LINEAR' && decryptedToken) {
      return this.ingestLinearConnectorEvents({
        tenantId,
        connectorId: connector.id,
        accessToken: decryptedToken,
        checkpoint: connector.checkpoint
      });
    }

    if (provider === 'JIRA' && decryptedToken) {
      return this.ingestJiraConnectorEvents({
        tenantId,
        connectorId: connector.id,
        accessToken: decryptedToken,
        checkpoint: connector.checkpoint
      });
    }

    const fixtures = this.selectFixtureLoader(provider);

    return this.ingestGenericConnectorEvents({
      tenantId,
      connectorId: connector.id,
      provider,
      events: fixtures,
      newCheckpoint: {} as Prisma.InputJsonValue
    });
  }

  async normalizeProviderEvents(tenantId: string, provider: Provider): Promise<{
    normalized: number;
    malformed: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const rawEvents = await this.prisma.rawEvent.findMany({
      where: {
        tenantId,
        provider,
        occurredAt: {
          gte: thirtyDaysAgo
        }
      },
      orderBy: {
        occurredAt: 'asc'
      }
    });

    let normalizedCount = 0;
    let malformedCount = 0;

    for (const rawEvent of rawEvents) {
      const normalized = normalizeRawConnectorEvent({
        provider,
        externalId: rawEvent.externalId,
        payload: rawEvent.payload
      });

      if (normalized.malformed) {
        malformedCount += 1;
      }

      await this.prisma.normalizedEvent.upsert({
        where: {
          tenantId_provider_externalId: {
            tenantId,
            provider,
            externalId: rawEvent.externalId
          }
        },
        update: {
          rawEventId: rawEvent.id,
          actor: normalized.actor,
          tool: normalized.tool,
          action: normalized.action,
          channel: normalized.channel,
          payload: normalized.payload as Prisma.InputJsonValue,
          malformed: normalized.malformed,
          failureReason: normalized.failureReason,
          occurredAt: rawEvent.occurredAt
        },
        create: {
          tenantId,
          rawEventId: rawEvent.id,
          provider,
          externalId: rawEvent.externalId,
          actor: normalized.actor,
          tool: normalized.tool,
          action: normalized.action,
          channel: normalized.channel,
          payload: normalized.payload as Prisma.InputJsonValue,
          malformed: normalized.malformed,
          failureReason: normalized.failureReason,
          occurredAt: rawEvent.occurredAt
        }
      });

      normalizedCount += 1;
    }

    return {
      normalized: normalizedCount,
      malformed: malformedCount
    };
  }

  async extractAndScore(tenantId: string): Promise<{
    workflows: number;
    reviewQueued: number;
  }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const normalizedEvents = await this.prisma.normalizedEvent.findMany({
      where: {
        tenantId,
        occurredAt: {
          gte: thirtyDaysAgo
        },
        malformed: false
      },
      orderBy: {
        occurredAt: 'asc'
      }
    });

    const extractionInput = normalizedEvents.map((event) => ({
      tenantId,
      provider: event.provider,
      externalId: event.externalId,
      actor: event.actor,
      tool: event.tool,
      action: event.action,
      channel: event.channel ?? undefined,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload as Record<string, unknown>
    }));

    const extractedWorkflows = extractWorkflows(extractionInput);

    let reviewQueued = 0;

    for (const extraction of extractedWorkflows) {
      const workflowRecord = await this.prisma.workflow.upsert({
        where: {
          tenantId_workflowKey: {
            tenantId,
            workflowKey: extraction.workflowKey
          }
        },
        update: {
          name: extraction.workflowName,
          confidence: extraction.confidence,
          avgMinutesPerRun: extraction.avgMinutesPerRun,
          monthlyRuns: extraction.monthlyRuns,
          eventCount30d: extractionInput.filter(
            (event) => event.payload.workflowHint === extraction.workflowKey
          ).length
        },
        create: {
          tenantId,
          workflowKey: extraction.workflowKey,
          name: extraction.workflowName,
          confidence: extraction.confidence,
          avgMinutesPerRun: extraction.avgMinutesPerRun,
          monthlyRuns: extraction.monthlyRuns,
          eventCount30d: extractionInput.filter(
            (event) => event.payload.workflowHint === extraction.workflowKey
          ).length
        }
      });

      await this.prisma.workflowNode.deleteMany({ where: { workflowId: workflowRecord.id } });
      await this.prisma.workflowEdge.deleteMany({ where: { workflowId: workflowRecord.id } });

      const nodeIdsBySequence = new Map<number, string>();
      for (const node of extraction.nodes) {
        const createdNode = await this.prisma.workflowNode.create({
          data: {
            tenantId,
            workflowId: workflowRecord.id,
            actor: node.actor,
            tool: node.tool,
            action: node.action,
            sequence: node.sequence,
            confidence: node.confidence
          }
        });

        nodeIdsBySequence.set(node.sequence, createdNode.id);
      }

      for (const edge of extraction.edges) {
        const fromNodeId = nodeIdsBySequence.get(edge.fromSequence);
        const toNodeId = nodeIdsBySequence.get(edge.toSequence);
        if (!fromNodeId || !toNodeId) {
          continue;
        }

        await this.prisma.workflowEdge.create({
          data: {
            tenantId,
            workflowId: workflowRecord.id,
            fromNodeId,
            toNodeId,
            confidence: edge.confidence
          }
        });
      }

      const workflowEvents = extractionInput.filter(
        (event) => event.payload.workflowHint === extraction.workflowKey
      );

      const runSizeMap = new Map<string, number>();
      for (const workflowEvent of workflowEvents) {
        const runKey =
          typeof workflowEvent.payload.runKey === 'string' ? workflowEvent.payload.runKey : 'default';
        runSizeMap.set(runKey, (runSizeMap.get(runKey) ?? 0) + 1);
      }

      const runSizes = [...runSizeMap.values()];

      const feasibilityInput = {
        workflowId: workflowRecord.id,
        tenantId,
        eventCount30d: workflowEvents.length,
        uniqueActorCount: new Set(workflowEvents.map((event) => event.actor)).size,
        uniqueToolCount: new Set(workflowEvents.map((event) => event.tool)).size,
        varianceRatio: computeVarianceRatio(runSizes),
        avgMinutesPerRun: extraction.avgMinutesPerRun,
        monthlyRuns: extraction.monthlyRuns
      };

      const rationaleCandidate =
        process.env.ENABLE_LLM_RATIONALE === 'true'
          ? this.feasibilityService.buildRationaleStub(feasibilityInput)
          : undefined;

      const feasibility = this.feasibilityService.score(feasibilityInput, rationaleCandidate);

      await this.prisma.feasibilityScore.upsert({
        where: {
          workflowId: workflowRecord.id
        },
        update: {
          tenantId,
          feasibilityScore: feasibility.feasibilityScore,
          confidence: feasibility.confidence,
          breakdown: feasibility.breakdown as unknown as Prisma.InputJsonValue,
          rationale: feasibility.rationale as unknown as Prisma.InputJsonValue
        },
        create: {
          tenantId,
          workflowId: workflowRecord.id,
          feasibilityScore: feasibility.feasibilityScore,
          confidence: feasibility.confidence,
          breakdown: feasibility.breakdown as unknown as Prisma.InputJsonValue,
          rationale: feasibility.rationale as unknown as Prisma.InputJsonValue
        }
      });

      const roi = scoreHlcRoi({
        workflowId: workflowRecord.id,
        tenantId,
        avgMinutesPerRun: extraction.avgMinutesPerRun,
        monthlyRuns: extraction.monthlyRuns,
        blendedHourlyRate: Number(process.env.BLENDED_HOURLY_RATE ?? 95),
        feasibilityScore: feasibility.feasibilityScore,
        implementationCost: Number(process.env.IMPLEMENTATION_COST_DEFAULT ?? 18000),
        annualPlatformCost: Number(process.env.ANNUAL_PLATFORM_COST ?? 4800)
      });

      await this.prisma.hlcEstimate.upsert({
        where: {
          workflowId: workflowRecord.id
        },
        update: {
          tenantId,
          annualLaborCost: roi.annualLaborCost
        },
        create: {
          tenantId,
          workflowId: workflowRecord.id,
          annualLaborCost: roi.annualLaborCost
        }
      });

      await this.prisma.roiSimulation.upsert({
        where: {
          workflowId: workflowRecord.id
        },
        update: {
          tenantId,
          annualLaborCost: roi.annualLaborCost,
          annualNetSavings: roi.annualNetSavings,
          paybackMonths: roi.paybackMonths,
          automationCoverage: roi.automationCoverage,
          roiScore: roi.roiScore
        },
        create: {
          tenantId,
          workflowId: workflowRecord.id,
          annualLaborCost: roi.annualLaborCost,
          annualNetSavings: roi.annualNetSavings,
          paybackMonths: roi.paybackMonths,
          automationCoverage: roi.automationCoverage,
          roiScore: roi.roiScore
        }
      });

      const recommendationStatus = deriveRecommendationStatus({
        workflowConfidence: extraction.confidence,
        feasibilityConfidence: feasibility.confidence,
        feasibilityScore: feasibility.feasibilityScore,
        annualNetSavings: roi.annualNetSavings
      }) as RecommendationStatus;

      const reviewStatus: ReviewStatus =
        recommendationStatus === 'NEEDS_REVIEW' ? 'PENDING_REVIEW' : 'AUTO_APPROVED';

      if (reviewStatus === 'PENDING_REVIEW') {
        reviewQueued += 1;
      }

      await this.prisma.reviewQueue.upsert({
        where: {
          workflowId: workflowRecord.id
        },
        update: {
          tenantId,
          recommendationStatus,
          reviewStatus,
          reason:
            reviewStatus === 'PENDING_REVIEW'
              ? 'Confidence below 0.70 threshold. Human review required.'
              : 'Auto-approved by deterministic confidence threshold.',
          reviewedAt: reviewStatus === 'AUTO_APPROVED' ? new Date() : null,
          reviewerId: reviewStatus === 'AUTO_APPROVED' ? 'system-auto-review' : null
        },
        create: {
          tenantId,
          workflowId: workflowRecord.id,
          recommendationStatus,
          reviewStatus,
          reason:
            reviewStatus === 'PENDING_REVIEW'
              ? 'Confidence below 0.70 threshold. Human review required.'
              : 'Auto-approved by deterministic confidence threshold.',
          reviewedAt: reviewStatus === 'AUTO_APPROVED' ? new Date() : null,
          reviewerId: reviewStatus === 'AUTO_APPROVED' ? 'system-auto-review' : null
        }
      });
    }

    return {
      workflows: extractedWorkflows.length,
      reviewQueued
    };
  }

  async runSeededAudit(tenantId: string): Promise<{
    slack: { ingested: number; duplicates: number; normalized: number; malformed: number };
    gmail: { ingested: number; duplicates: number; normalized: number; malformed: number };
    workflows: number;
    reviewQueued: number;
  }> {
    this.logger.log(`Running seeded audit for tenant ${tenantId}`);

    const slackIngestion = await this.ingestProviderFixtures(tenantId, 'SLACK');
    const gmailIngestion = await this.ingestProviderFixtures(tenantId, 'GMAIL');

    const slackNormalization = await this.normalizeProviderEvents(tenantId, 'SLACK');
    const gmailNormalization = await this.normalizeProviderEvents(tenantId, 'GMAIL');

    const workflowResult = await this.extractAndScore(tenantId);

    return {
      slack: {
        ...slackIngestion,
        ...slackNormalization
      },
      gmail: {
        ...gmailIngestion,
        ...gmailNormalization
      },
      workflows: workflowResult.workflows,
      reviewQueued: workflowResult.reviewQueued
    };
  }
}
