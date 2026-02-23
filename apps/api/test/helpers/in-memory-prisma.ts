import { Provider, RecommendationStatus, ReviewStatus } from '@prisma/client';

interface TenantRecord {
  id: string;
  name: string;
}

interface ConnectorRecord {
  id: string;
  tenantId: string;
  provider: Provider;
  mode: 'READ_ONLY';
  accessToken: string | null;
  refreshToken: string | null;
  checkpoint: unknown;
  lastSyncedAt: Date | null;
}

interface RawEventRecord {
  id: string;
  tenantId: string;
  connectorId: string;
  provider: Provider;
  externalId: string;
  eventHash: string;
  payload: unknown;
  occurredAt: Date;
}

interface NormalizedEventRecord {
  id: string;
  tenantId: string;
  rawEventId: string | null;
  provider: Provider;
  externalId: string;
  actor: string;
  tool: string;
  action: string;
  channel: string | null;
  payload: unknown;
  malformed: boolean;
  failureReason: string | null;
  occurredAt: Date;
}

interface WorkflowRecord {
  id: string;
  tenantId: string;
  workflowKey: string;
  name: string;
  confidence: number;
  avgMinutesPerRun: number;
  monthlyRuns: number;
  eventCount30d: number;
}

interface WorkflowNodeRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  actor: string;
  tool: string;
  action: string;
  sequence: number;
  confidence: number;
}

interface WorkflowEdgeRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  fromNodeId: string;
  toNodeId: string;
  confidence: number;
}

interface FeasibilityRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  feasibilityScore: number;
  confidence: number;
  breakdown: unknown;
  rationale: unknown;
}

interface HlcRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  annualLaborCost: number;
}

interface RoiRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  annualLaborCost: number;
  annualNetSavings: number;
  paybackMonths: number | null;
  automationCoverage: number;
  roiScore: number;
}

interface ReviewQueueRecord {
  id: string;
  tenantId: string;
  workflowId: string;
  recommendationStatus: RecommendationStatus;
  reviewStatus: ReviewStatus;
  reason: string | null;
  reviewerId: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

function sortByOccurredAtAsc<T extends { occurredAt: Date }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
}

export class InMemoryPrismaService {
  private sequence = 0;

  private readonly tenants = new Map<string, TenantRecord>();
  private readonly connectorsByComposite = new Map<string, ConnectorRecord>();
  private readonly connectorsById = new Map<string, ConnectorRecord>();
  private readonly rawEvents: RawEventRecord[] = [];
  private readonly normalizedByComposite = new Map<string, NormalizedEventRecord>();
  private readonly workflowsByComposite = new Map<string, WorkflowRecord>();
  private readonly workflowsById = new Map<string, WorkflowRecord>();
  private readonly workflowNodes: WorkflowNodeRecord[] = [];
  private readonly workflowEdges: WorkflowEdgeRecord[] = [];
  private readonly feasibilityByWorkflowId = new Map<string, FeasibilityRecord>();
  private readonly hlcByWorkflowId = new Map<string, HlcRecord>();
  private readonly roiByWorkflowId = new Map<string, RoiRecord>();
  private readonly reviewQueueByWorkflowId = new Map<string, ReviewQueueRecord>();

  private nextId(prefix: string): string {
    this.sequence += 1;
    return `${prefix}_${this.sequence}`;
  }

  private connectorCompositeKey(tenantId: string, provider: Provider): string {
    return `${tenantId}:${provider}`;
  }

  private normalizedCompositeKey(tenantId: string, provider: Provider, externalId: string): string {
    return `${tenantId}:${provider}:${externalId}`;
  }

  private workflowCompositeKey(tenantId: string, workflowKey: string): string {
    return `${tenantId}:${workflowKey}`;
  }

  tenant = {
    upsert: async (args: {
      where: { id: string };
      update: Record<string, never>;
      create: { id: string; name: string };
    }): Promise<TenantRecord> => {
      const existing = this.tenants.get(args.where.id);
      if (existing) {
        return existing;
      }

      const created: TenantRecord = {
        id: args.create.id,
        name: args.create.name
      };
      this.tenants.set(created.id, created);
      return created;
    }
  };

  connector = {
    upsert: async (args: {
      where: { tenantId_provider: { tenantId: string; provider: Provider } };
      update: { mode: 'READ_ONLY' };
      create: { tenantId: string; provider: Provider; mode: 'READ_ONLY' };
      select: { id: true; accessToken: true; checkpoint: true };
    }): Promise<{ id: string; accessToken: string | null; checkpoint: unknown }> => {
      const key = this.connectorCompositeKey(
        args.where.tenantId_provider.tenantId,
        args.where.tenantId_provider.provider
      );
      const existing = this.connectorsByComposite.get(key);

      if (existing) {
        existing.mode = args.update.mode;
        return {
          id: existing.id,
          accessToken: existing.accessToken,
          checkpoint: existing.checkpoint
        };
      }

      const created: ConnectorRecord = {
        id: this.nextId('connector'),
        tenantId: args.create.tenantId,
        provider: args.create.provider,
        mode: args.create.mode,
        accessToken: null,
        refreshToken: null,
        checkpoint: null,
        lastSyncedAt: null
      };
      this.connectorsByComposite.set(key, created);
      this.connectorsById.set(created.id, created);

      return {
        id: created.id,
        accessToken: created.accessToken,
        checkpoint: created.checkpoint
      };
    },
    update: async (args: {
      where: { id: string };
      data: Partial<ConnectorRecord>;
    }): Promise<ConnectorRecord> => {
      const connector = this.connectorsById.get(args.where.id);
      if (!connector) {
        throw new Error(`Connector not found: ${args.where.id}`);
      }

      Object.assign(connector, args.data);
      return connector;
    }
  };

  rawEvent = {
    findUnique: async (args: {
      where: {
        tenantId_provider_eventHash: {
          tenantId: string;
          provider: Provider;
          eventHash: string;
        };
      };
      select: { id: true };
    }): Promise<{ id: string } | null> => {
      const match = this.rawEvents.find(
        (event) =>
          event.tenantId === args.where.tenantId_provider_eventHash.tenantId &&
          event.provider === args.where.tenantId_provider_eventHash.provider &&
          event.eventHash === args.where.tenantId_provider_eventHash.eventHash
      );

      if (!match) {
        return null;
      }

      return {
        id: match.id
      };
    },
    create: async (args: { data: Omit<RawEventRecord, 'id'> }): Promise<RawEventRecord> => {
      const created: RawEventRecord = {
        id: this.nextId('raw'),
        ...args.data
      };
      this.rawEvents.push(created);
      return created;
    },
    findMany: async (args: {
      where: {
        tenantId: string;
        provider: Provider;
        occurredAt: { gte: Date };
      };
      orderBy: { occurredAt: 'asc' };
    }): Promise<RawEventRecord[]> => {
      const filtered = this.rawEvents.filter(
        (event) =>
          event.tenantId === args.where.tenantId &&
          event.provider === args.where.provider &&
          event.occurredAt.getTime() >= args.where.occurredAt.gte.getTime()
      );

      return sortByOccurredAtAsc(filtered);
    }
  };

  normalizedEvent = {
    upsert: async (args: {
      where: {
        tenantId_provider_externalId: {
          tenantId: string;
          provider: Provider;
          externalId: string;
        };
      };
      update: Omit<NormalizedEventRecord, 'id' | 'tenantId' | 'provider' | 'externalId'>;
      create: Omit<NormalizedEventRecord, 'id'>;
    }): Promise<NormalizedEventRecord> => {
      const key = this.normalizedCompositeKey(
        args.where.tenantId_provider_externalId.tenantId,
        args.where.tenantId_provider_externalId.provider,
        args.where.tenantId_provider_externalId.externalId
      );
      const existing = this.normalizedByComposite.get(key);

      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: NormalizedEventRecord = {
        id: this.nextId('normalized'),
        ...args.create
      };
      this.normalizedByComposite.set(key, created);
      return created;
    },
    findMany: async (args: {
      where: {
        tenantId: string;
        occurredAt: { gte: Date };
        malformed: boolean;
      };
      orderBy: { occurredAt: 'asc' };
    }): Promise<NormalizedEventRecord[]> => {
      const all = [...this.normalizedByComposite.values()];
      const filtered = all.filter(
        (event) =>
          event.tenantId === args.where.tenantId &&
          event.occurredAt.getTime() >= args.where.occurredAt.gte.getTime() &&
          event.malformed === args.where.malformed
      );

      return sortByOccurredAtAsc(filtered);
    }
  };

  workflow = {
    upsert: async (args: {
      where: { tenantId_workflowKey: { tenantId: string; workflowKey: string } };
      update: Omit<WorkflowRecord, 'id' | 'tenantId' | 'workflowKey'>;
      create: Omit<WorkflowRecord, 'id'>;
    }): Promise<WorkflowRecord> => {
      const key = this.workflowCompositeKey(
        args.where.tenantId_workflowKey.tenantId,
        args.where.tenantId_workflowKey.workflowKey
      );
      const existing = this.workflowsByComposite.get(key);

      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: WorkflowRecord = {
        id: this.nextId('workflow'),
        ...args.create
      };
      this.workflowsByComposite.set(key, created);
      this.workflowsById.set(created.id, created);
      return created;
    },
    findMany: async (args: {
      where: { tenantId: string };
      include: {
        feasibility: true;
        roiSimulation: true;
        reviewItem: true;
      };
    }): Promise<
      Array<
        WorkflowRecord & {
          feasibility: FeasibilityRecord | null;
          roiSimulation: RoiRecord | null;
          reviewItem: ReviewQueueRecord | null;
        }
      >
    > => {
      const workflows = [...this.workflowsById.values()].filter(
        (workflow) => workflow.tenantId === args.where.tenantId
      );

      return workflows.map((workflow) => ({
        ...workflow,
        feasibility: this.feasibilityByWorkflowId.get(workflow.id) ?? null,
        roiSimulation: this.roiByWorkflowId.get(workflow.id) ?? null,
        reviewItem: this.reviewQueueByWorkflowId.get(workflow.id) ?? null
      }));
    }
  };

  workflowNode = {
    deleteMany: async (args: { where: { workflowId: string } }): Promise<{ count: number }> => {
      const before = this.workflowNodes.length;
      const kept = this.workflowNodes.filter((node) => node.workflowId !== args.where.workflowId);
      this.workflowNodes.length = 0;
      this.workflowNodes.push(...kept);
      return {
        count: before - kept.length
      };
    },
    create: async (args: { data: Omit<WorkflowNodeRecord, 'id'> }): Promise<WorkflowNodeRecord> => {
      const created: WorkflowNodeRecord = {
        id: this.nextId('node'),
        ...args.data
      };
      this.workflowNodes.push(created);
      return created;
    }
  };

  workflowEdge = {
    deleteMany: async (args: { where: { workflowId: string } }): Promise<{ count: number }> => {
      const before = this.workflowEdges.length;
      const kept = this.workflowEdges.filter((edge) => edge.workflowId !== args.where.workflowId);
      this.workflowEdges.length = 0;
      this.workflowEdges.push(...kept);
      return {
        count: before - kept.length
      };
    },
    create: async (args: { data: Omit<WorkflowEdgeRecord, 'id'> }): Promise<WorkflowEdgeRecord> => {
      const created: WorkflowEdgeRecord = {
        id: this.nextId('edge'),
        ...args.data
      };
      this.workflowEdges.push(created);
      return created;
    }
  };

  feasibilityScore = {
    upsert: async (args: {
      where: { workflowId: string };
      update: Omit<FeasibilityRecord, 'id' | 'workflowId'>;
      create: Omit<FeasibilityRecord, 'id'>;
    }): Promise<FeasibilityRecord> => {
      const existing = this.feasibilityByWorkflowId.get(args.where.workflowId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: FeasibilityRecord = {
        id: this.nextId('feasibility'),
        ...args.create
      };
      this.feasibilityByWorkflowId.set(created.workflowId, created);
      return created;
    }
  };

  hlcEstimate = {
    upsert: async (args: {
      where: { workflowId: string };
      update: Omit<HlcRecord, 'id' | 'workflowId'>;
      create: Omit<HlcRecord, 'id'>;
    }): Promise<HlcRecord> => {
      const existing = this.hlcByWorkflowId.get(args.where.workflowId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: HlcRecord = {
        id: this.nextId('hlc'),
        ...args.create
      };
      this.hlcByWorkflowId.set(created.workflowId, created);
      return created;
    }
  };

  roiSimulation = {
    upsert: async (args: {
      where: { workflowId: string };
      update: Omit<RoiRecord, 'id' | 'workflowId'>;
      create: Omit<RoiRecord, 'id'>;
    }): Promise<RoiRecord> => {
      const existing = this.roiByWorkflowId.get(args.where.workflowId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: RoiRecord = {
        id: this.nextId('roi'),
        ...args.create
      };
      this.roiByWorkflowId.set(created.workflowId, created);
      return created;
    }
  };

  reviewQueue = {
    upsert: async (args: {
      where: { workflowId: string };
      update: Omit<ReviewQueueRecord, 'id' | 'workflowId' | 'createdAt'>;
      create: Omit<ReviewQueueRecord, 'id' | 'createdAt'>;
    }): Promise<ReviewQueueRecord> => {
      const existing = this.reviewQueueByWorkflowId.get(args.where.workflowId);
      if (existing) {
        Object.assign(existing, args.update);
        return existing;
      }

      const created: ReviewQueueRecord = {
        id: this.nextId('review'),
        createdAt: new Date(),
        ...args.create
      };
      this.reviewQueueByWorkflowId.set(created.workflowId, created);
      return created;
    }
  };
}
