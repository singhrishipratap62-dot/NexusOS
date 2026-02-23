import {
  Prisma,
  PrismaClient,
  Provider,
  RecommendationStatus,
  ReviewStatus
} from '@prisma/client';
import { Job, Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import {
  buildRawEventHash,
  deriveRecommendationStatus,
  extractWorkflows,
  GmailReadOnlyCheckpoint,
  GmailReadOnlyConnector,
  loadGmailAuditFixtures,
  loadSlackAuditFixtures,
  normalizeRawConnectorEvent,
  QUEUE_NAMES,
  safeDecryptToken,
  SlackReadOnlyCheckpoint,
  SlackReadOnlyConnector,
  scoreFeasibility,
  scoreHlcRoi,
  SyncConnectorJobPayload
} from '@nexus/shared';
import { processSyncConnectorJob } from './sync/process-sync-job';

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const connection: any = new IORedis(redisUrl, {
  maxRetriesPerRequest: null
});

const ingestionQueue = new Queue(QUEUE_NAMES.ingestion, { connection: connection as never });
const workflowQueue = new Queue(QUEUE_NAMES.workflow, { connection: connection as never });

function computeVarianceRatio(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) * (value - mean), 0) /
    Math.max(1, values.length - 1);

  return Number((Math.sqrt(variance) / Math.max(1, mean)).toFixed(4));
}

async function ensureTenant(tenantId: string): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: 'NexusOS Day-1 Tenant'
    }
  });
}

async function ensureConnector(
  tenantId: string,
  provider: Provider
): Promise<{ id: string; accessToken: string | null; checkpoint: Prisma.JsonValue | null }> {
  return prisma.connector.upsert({
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

function parseSlackCheckpoint(checkpoint: Prisma.JsonValue | null): SlackReadOnlyCheckpoint {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
    return {};
  }

  return checkpoint as SlackReadOnlyCheckpoint;
}

function parseGmailCheckpoint(checkpoint: Prisma.JsonValue | null): GmailReadOnlyCheckpoint {
  if (!checkpoint || typeof checkpoint !== 'object' || Array.isArray(checkpoint)) {
    return {};
  }

  return checkpoint as GmailReadOnlyCheckpoint;
}

async function ingestSlackConnectorEvents(input: {
  tenantId: string;
  connectorId: string;
  accessToken: string;
  checkpoint: Prisma.JsonValue | null;
}): Promise<{
  inserted: number;
  duplicate: number;
  lastEventAt: Date | null;
}> {
  const configuredChannels = (process.env.SLACK_CHANNEL_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const connector = new SlackReadOnlyConnector(input.accessToken, {
    maxRetries: Number(process.env.SLACK_MAX_RETRIES ?? 4),
    initialBackoffMs: Number(process.env.SLACK_BACKOFF_MS ?? 350)
  });

  const pullResult = await connector.pullMessages({
    checkpoint: parseSlackCheckpoint(input.checkpoint),
    channelIds: configuredChannels.length > 0 ? configuredChannels : undefined
  });

  let inserted = 0;
  let duplicate = 0;
  let lastEventAt: Date | null = null;

  for (const event of pullResult.events) {
    const eventHash = buildRawEventHash({
      provider: 'SLACK',
      externalId: event.externalId,
      occurredAt: event.occurredAt,
      payload: event.payload
    });

    const existing = await prisma.rawEvent.findUnique({
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
      duplicate += 1;
      continue;
    }

    const occurredAt = new Date(event.occurredAt);
    await prisma.rawEvent.create({
      data: {
        tenantId: input.tenantId,
        connectorId: input.connectorId,
        provider: 'SLACK',
        externalId: event.externalId,
        eventHash,
        payload: event.payload as Prisma.InputJsonValue,
        occurredAt
      }
    });

    if (!lastEventAt || occurredAt.getTime() > lastEventAt.getTime()) {
      lastEventAt = occurredAt;
    }

    inserted += 1;
  }

  await prisma.connector.update({
    where: { id: input.connectorId },
    data: {
      checkpoint: pullResult.checkpoint as unknown as Prisma.InputJsonValue,
      lastSyncedAt: new Date()
    }
  });

  return {
    inserted,
    duplicate,
    lastEventAt
  };
}

async function ingestGmailConnectorEvents(input: {
  tenantId: string;
  connectorId: string;
  accessToken: string;
  checkpoint: Prisma.JsonValue | null;
}): Promise<{
  inserted: number;
  duplicate: number;
  lastEventAt: Date | null;
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

  let inserted = 0;
  let duplicate = 0;
  let lastEventAt: Date | null = null;

  for await (const page of connector.pullMessagePages({
    checkpoint: parseGmailCheckpoint(input.checkpoint),
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

      const existing = await prisma.rawEvent.findUnique({
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
        duplicate += 1;
        continue;
      }

      const occurredAt = new Date(event.occurredAt);
      await prisma.rawEvent.create({
        data: {
          tenantId: input.tenantId,
          connectorId: input.connectorId,
          provider: 'GMAIL',
          externalId: event.externalId,
          eventHash,
          payload: event.payload as Prisma.InputJsonValue,
          occurredAt
        }
      });

      if (!lastEventAt || occurredAt.getTime() > lastEventAt.getTime()) {
        lastEventAt = occurredAt;
      }

      inserted += 1;
    }

    await prisma.connector.update({
      where: { id: input.connectorId },
      data: {
        checkpoint: page.checkpoint as unknown as Prisma.InputJsonValue,
        ...(page.checkpoint.nextPageToken ? {} : { lastSyncedAt: new Date() })
      }
    });
  }

  return {
    inserted,
    duplicate,
    lastEventAt
  };
}

async function ingestProviderEvents(tenantId: string, provider: Provider): Promise<{
  inserted: number;
  duplicate: number;
  lastEventAt: Date | null;
}> {
  await ensureTenant(tenantId);
  const connector = await ensureConnector(tenantId, provider);

  const decryptedToken = safeDecryptToken(connector.accessToken);

  if (provider === 'SLACK' && decryptedToken) {
    return ingestSlackConnectorEvents({
      tenantId,
      connectorId: connector.id,
      accessToken: decryptedToken,
      checkpoint: connector.checkpoint
    });
  }

  if (provider === 'GMAIL' && decryptedToken) {
    return ingestGmailConnectorEvents({
      tenantId,
      connectorId: connector.id,
      accessToken: decryptedToken,
      checkpoint: connector.checkpoint
    });
  }

  const fixtures = provider === 'SLACK' ? loadSlackAuditFixtures() : loadGmailAuditFixtures();

  let inserted = 0;
  let duplicate = 0;
  let lastEventAt: Date | null = null;

  for (const fixture of fixtures) {
    const eventHash = buildRawEventHash({
      provider,
      externalId: fixture.externalId,
      occurredAt: fixture.occurredAt,
      payload: fixture.payload
    });

    const existing = await prisma.rawEvent.findUnique({
      where: {
        tenantId_provider_eventHash: {
          tenantId,
          provider,
          eventHash
        }
      },
      select: {
        id: true
      }
    });

    if (existing) {
      duplicate += 1;
      continue;
    }

    const occurredAt = new Date(fixture.occurredAt);

    await prisma.rawEvent.create({
      data: {
        tenantId,
        connectorId: connector.id,
        provider,
        externalId: fixture.externalId,
        eventHash,
        payload: fixture.payload as Prisma.InputJsonValue,
        occurredAt
      }
    });

    if (!lastEventAt || occurredAt.getTime() > lastEventAt.getTime()) {
      lastEventAt = occurredAt;
    }

    inserted += 1;
  }

  await prisma.connector.update({
    where: { id: connector.id },
    data: {
      checkpoint: {
        lastSyncedProviderTimestamp: lastEventAt?.toISOString() ?? null
      },
      lastSyncedAt: new Date()
    }
  });

  return {
    inserted,
    duplicate,
    lastEventAt
  };
}

async function normalizeProviderEvents(tenantId: string, provider: Provider): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const rawEvents = await prisma.rawEvent.findMany({
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

  for (const rawEvent of rawEvents) {
    const normalized = normalizeRawConnectorEvent({
      provider,
      externalId: rawEvent.externalId,
      payload: rawEvent.payload
    });

    await prisma.normalizedEvent.upsert({
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
  }
}

async function extractAndScore(tenantId: string): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const normalizedEvents = await prisma.normalizedEvent.findMany({
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

  const workflows = extractWorkflows(extractionInput);

  for (const extracted of workflows) {
    const workflowEvents = extractionInput.filter(
      (event) => event.payload.workflowHint === extracted.workflowKey
    );

    const workflow = await prisma.workflow.upsert({
      where: {
        tenantId_workflowKey: {
          tenantId,
          workflowKey: extracted.workflowKey
        }
      },
      update: {
        name: extracted.workflowName,
        confidence: extracted.confidence,
        avgMinutesPerRun: extracted.avgMinutesPerRun,
        monthlyRuns: extracted.monthlyRuns,
        eventCount30d: workflowEvents.length
      },
      create: {
        tenantId,
        workflowKey: extracted.workflowKey,
        name: extracted.workflowName,
        confidence: extracted.confidence,
        avgMinutesPerRun: extracted.avgMinutesPerRun,
        monthlyRuns: extracted.monthlyRuns,
        eventCount30d: workflowEvents.length
      }
    });

    await prisma.workflowNode.deleteMany({ where: { workflowId: workflow.id } });
    await prisma.workflowEdge.deleteMany({ where: { workflowId: workflow.id } });

    const nodeIdsBySequence = new Map<number, string>();
    for (const node of extracted.nodes) {
      const createdNode = await prisma.workflowNode.create({
        data: {
          tenantId,
          workflowId: workflow.id,
          actor: node.actor,
          tool: node.tool,
          action: node.action,
          sequence: node.sequence,
          confidence: node.confidence
        }
      });
      nodeIdsBySequence.set(node.sequence, createdNode.id);
    }

    for (const edge of extracted.edges) {
      const fromNodeId = nodeIdsBySequence.get(edge.fromSequence);
      const toNodeId = nodeIdsBySequence.get(edge.toSequence);
      if (!fromNodeId || !toNodeId) {
        continue;
      }

      await prisma.workflowEdge.create({
        data: {
          tenantId,
          workflowId: workflow.id,
          fromNodeId,
          toNodeId,
          confidence: edge.confidence
        }
      });
    }

    const runSizeMap = new Map<string, number>();
    for (const event of workflowEvents) {
      const runKey = typeof event.payload.runKey === 'string' ? event.payload.runKey : 'default';
      runSizeMap.set(runKey, (runSizeMap.get(runKey) ?? 0) + 1);
    }

    const runSizes = [...runSizeMap.values()];

    const feasibility = scoreFeasibility({
      workflowId: workflow.id,
      tenantId,
      eventCount30d: workflowEvents.length,
      uniqueActorCount: new Set(workflowEvents.map((event) => event.actor)).size,
      uniqueToolCount: new Set(workflowEvents.map((event) => event.tool)).size,
      varianceRatio: computeVarianceRatio(runSizes),
      avgMinutesPerRun: extracted.avgMinutesPerRun,
      monthlyRuns: extracted.monthlyRuns
    });

    await prisma.feasibilityScore.upsert({
      where: {
        workflowId: workflow.id
      },
      update: {
        tenantId,
        feasibilityScore: feasibility.feasibilityScore,
        confidence: feasibility.confidence,
        breakdown: feasibility.breakdown as unknown as Prisma.InputJsonValue
      },
      create: {
        tenantId,
        workflowId: workflow.id,
        feasibilityScore: feasibility.feasibilityScore,
        confidence: feasibility.confidence,
        breakdown: feasibility.breakdown as unknown as Prisma.InputJsonValue
      }
    });

    const roi = scoreHlcRoi({
      workflowId: workflow.id,
      tenantId,
      avgMinutesPerRun: extracted.avgMinutesPerRun,
      monthlyRuns: extracted.monthlyRuns,
      blendedHourlyRate: Number(process.env.BLENDED_HOURLY_RATE ?? 95),
      feasibilityScore: feasibility.feasibilityScore,
      implementationCost: Number(process.env.IMPLEMENTATION_COST_DEFAULT ?? 18000),
      annualPlatformCost: Number(process.env.ANNUAL_PLATFORM_COST ?? 4800)
    });

    await prisma.hlcEstimate.upsert({
      where: {
        workflowId: workflow.id
      },
      update: {
        tenantId,
        annualLaborCost: roi.annualLaborCost
      },
      create: {
        tenantId,
        workflowId: workflow.id,
        annualLaborCost: roi.annualLaborCost
      }
    });

    await prisma.roiSimulation.upsert({
      where: {
        workflowId: workflow.id
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
        workflowId: workflow.id,
        annualLaborCost: roi.annualLaborCost,
        annualNetSavings: roi.annualNetSavings,
        paybackMonths: roi.paybackMonths,
        automationCoverage: roi.automationCoverage,
        roiScore: roi.roiScore
      }
    });

    const recommendationStatus = deriveRecommendationStatus({
      workflowConfidence: workflow.confidence,
      feasibilityConfidence: feasibility.confidence,
      feasibilityScore: feasibility.feasibilityScore,
      annualNetSavings: roi.annualNetSavings
    }) as RecommendationStatus;

    const reviewStatus: ReviewStatus =
      recommendationStatus === 'NEEDS_REVIEW' ? 'PENDING_REVIEW' : 'AUTO_APPROVED';

    await prisma.reviewQueue.upsert({
      where: {
        workflowId: workflow.id
      },
      update: {
        tenantId,
        recommendationStatus,
        reviewStatus,
        reason:
          reviewStatus === 'PENDING_REVIEW'
            ? 'Confidence below 0.70 threshold. Human review required.'
            : 'Auto-approved by deterministic confidence threshold.',
        reviewerId: reviewStatus === 'AUTO_APPROVED' ? 'system-auto-review' : null,
        reviewedAt: reviewStatus === 'AUTO_APPROVED' ? new Date() : null
      },
      create: {
        tenantId,
        workflowId: workflow.id,
        recommendationStatus,
        reviewStatus,
        reason:
          reviewStatus === 'PENDING_REVIEW'
            ? 'Confidence below 0.70 threshold. Human review required.'
            : 'Auto-approved by deterministic confidence threshold.',
        reviewerId: reviewStatus === 'AUTO_APPROVED' ? 'system-auto-review' : null,
        reviewedAt: reviewStatus === 'AUTO_APPROVED' ? new Date() : null
      }
    });
  }
}

const ingestionWorker = new Worker(
  QUEUE_NAMES.ingestion,
  async (job: Job): Promise<void> => {
    if (job.name === 'sync-connector') {
      const payload = job.data as SyncConnectorJobPayload;

      await processSyncConnectorJob(payload, {
        prisma: {
          syncJob: prisma.syncJob
        },
        ingestProviderEvents,
        enqueueNormalizeEvents: async (normalizePayload) =>
          ingestionQueue.add('normalize-events', normalizePayload, {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000
            }
          })
      });

      return;
    }

    if (job.name === 'normalize-events') {
      const payload = job.data as { tenantId: string; provider: Provider };
      await normalizeProviderEvents(payload.tenantId, payload.provider);
      await workflowQueue.add(
        'extract-and-score',
        {
          tenantId: payload.tenantId
        },
        {
          attempts: 2,
          backoff: {
            type: 'exponential',
            delay: 1000
          }
        }
      );
    }
  },
  {
    connection: connection as never
  }
);

const workflowWorker = new Worker(
  QUEUE_NAMES.workflow,
  async (job: Job): Promise<void> => {
    if (job.name !== 'extract-and-score') {
      return;
    }

    const payload = job.data as { tenantId: string };
    await extractAndScore(payload.tenantId);
  },
  {
    connection: connection as never
  }
);

async function bootstrap(): Promise<void> {
  await prisma.$connect();
  // eslint-disable-next-line no-console
  console.log('NexusOS workers started');
}

bootstrap().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error('Worker bootstrap failed', error);
  await prisma.$disconnect();
  process.exit(1);
});

const shutdown = async (): Promise<void> => {
  await Promise.all([
    ingestionWorker.close(),
    workflowWorker.close(),
    ingestionQueue.close(),
    workflowQueue.close()
  ]);
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
