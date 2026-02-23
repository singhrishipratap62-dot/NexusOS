export type Provider = 'SLACK' | 'GMAIL' | 'NOTION' | 'LINEAR' | 'GITHUB' | 'JIRA' | 'GCAL';

export type ReviewStatus =
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'AUTO_APPROVED';

export type RecommendationStatus =
  | 'NEEDS_REVIEW'
  | 'RECOMMENDED'
  | 'NOT_RECOMMENDED';

export interface NormalizedEvent {
  tenantId: string;
  provider: Provider;
  externalId: string;
  actor: string;
  tool: string;
  action: string;
  channel?: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface WorkflowNode {
  id: string;
  tenantId: string;
  workflowId: string;
  actor: string;
  tool: string;
  action: string;
  sequence: number;
  confidence: number;
}

export interface WorkflowEdge {
  id: string;
  tenantId: string;
  workflowId: string;
  fromNodeId: string;
  toNodeId: string;
  confidence: number;
}

export interface WorkflowExtractionResult {
  workflowKey: string;
  workflowName: string;
  confidence: number;
  avgMinutesPerRun: number;
  monthlyRuns: number;
  nodes: Array<{
    actor: string;
    tool: string;
    action: string;
    sequence: number;
    confidence: number;
  }>;
  edges: Array<{
    fromSequence: number;
    toSequence: number;
    confidence: number;
  }>;
}

export interface FeasibilityInput {
  workflowId: string;
  tenantId: string;
  eventCount30d: number;
  uniqueActorCount: number;
  uniqueToolCount: number;
  varianceRatio: number;
  avgMinutesPerRun: number;
  monthlyRuns: number;
}

export interface FeasibilityBreakdown {
  processStability: number;
  integrationComplexity: number;
  dataAvailability: number;
  exceptionRisk: number;
}

export interface FeasibilityResult {
  feasibilityScore: number;
  confidence: number;
  breakdown: FeasibilityBreakdown;
  rationale?: FeasibilityRationale;
}

export interface HlcRoiInput {
  workflowId: string;
  tenantId: string;
  avgMinutesPerRun: number;
  monthlyRuns: number;
  blendedHourlyRate: number;
  feasibilityScore: number;
  implementationCost: number;
  annualPlatformCost: number;
}

export interface HlcRoiResult {
  annualLaborCost: number;
  annualNetSavings: number;
  paybackMonths: number | null;
  automationCoverage: number;
  roiScore: number;
}

export interface WarRoomOpportunity {
  workflowId: string;
  workflowName: string;
  feasibilityScore: number;
  feasibilityConfidence: number;
  annualLaborCost: number;
  annualNetSavings: number;
  paybackMonths: number | null;
  roiScore: number;
  workflowConfidence: number;
  recommendationStatus: RecommendationStatus;
  reviewStatus: ReviewStatus;
}

export interface FeasibilityRationale {
  version: '1';
  summary: string;
  blockers: string[];
  assumptions: string[];
  confidence: number;
}

export const FEASIBILITY_RATIONALE_JSON_SCHEMA = {
  $id: 'https://nexusos.dev/schema/feasibility-rationale-v1.json',
  type: 'object',
  additionalProperties: false,
  required: ['version', 'summary', 'blockers', 'assumptions', 'confidence'],
  properties: {
    version: { type: 'string', const: '1' },
    summary: { type: 'string', minLength: 1, maxLength: 600 },
    blockers: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 200 },
      maxItems: 8
    },
    assumptions: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 200 },
      maxItems: 8
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 }
  }
} as const;

export const REVIEW_THRESHOLD = 0.7;

export type BlueprintStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

export type TriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT';

export type RunStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'WAITING_HITL';

export interface AutomationBlueprint {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  workflowId: string | null;
  status: BlueprintStatus;
  triggerType: TriggerType;
  triggerConfig: Record<string, any> | null;
  steps: AutomationStep[];
  dryRun: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationStep {
  id: string;
  connectorId: string;
  action: string;
  parameters: Record<string, any>;
  name?: string;
}

export interface AutomationRun {
  id: string;
  tenantId: string;
  blueprintId: string;
  status: RunStatus;
  triggeredBy: string;
  dryRun: boolean;
  stepResults: Record<string, any>[] | null;
  logs: string[] | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
}
