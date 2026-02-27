export type Provider = 'SLACK' | 'GMAIL';
export type ReviewStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'AUTO_APPROVED';
export type RecommendationStatus = 'NEEDS_REVIEW' | 'RECOMMENDED' | 'NOT_RECOMMENDED';
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
    monthlyRuns: number;
    avgMinutesPerRun: number;
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
export declare const FEASIBILITY_RATIONALE_JSON_SCHEMA: {
    readonly $id: "https://nexusos.dev/schema/feasibility-rationale-v1.json";
    readonly type: "object";
    readonly additionalProperties: false;
    readonly required: readonly ["version", "summary", "blockers", "assumptions", "confidence"];
    readonly properties: {
        readonly version: {
            readonly type: "string";
            readonly const: "1";
        };
        readonly summary: {
            readonly type: "string";
            readonly minLength: 1;
            readonly maxLength: 600;
        };
        readonly blockers: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 200;
            };
            readonly maxItems: 8;
        };
        readonly assumptions: {
            readonly type: "array";
            readonly items: {
                readonly type: "string";
                readonly minLength: 1;
                readonly maxLength: 200;
            };
            readonly maxItems: 8;
        };
        readonly confidence: {
            readonly type: "number";
            readonly minimum: 0;
            readonly maximum: 1;
        };
    };
};
export declare const REVIEW_THRESHOLD = 0.7;
