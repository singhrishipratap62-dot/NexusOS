export const QUEUE_NAMES = {
  ingestion: 'ingestion-jobs',
  workflow: 'workflow-jobs',
  automation: 'automation-jobs'
} as const;

export type IngestionJobName = 'sync-connector' | 'normalize-events';
export type WorkflowJobName = 'extract-and-score';
export type AutomationJobName = 'run-blueprint';

export interface SyncConnectorJobPayload {
  tenantId: string;
  connectorId: string;
  syncJobId: string;
  provider: 'SLACK' | 'GMAIL' | 'GITHUB' | 'NOTION' | 'LINEAR' | 'JIRA' | 'GCAL';
}

export interface NormalizeEventsJobPayload {
  tenantId: string;
  provider: 'SLACK' | 'GMAIL' | 'GITHUB' | 'NOTION' | 'LINEAR' | 'JIRA' | 'GCAL';
}

export interface ExtractAndScoreJobPayload {
  tenantId: string;
}

export interface AutomationRunJobPayload {
  tenantId: string;
  runId: string;
}
