'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../components/ui/top-bar';
import { ConnectorsGrid } from '../../components/connectors-grid';
import { SyncHistoryTable } from '../../components/sync-history-table';
import { clientApiFetch as apiFetch } from '../../lib/api-client';

interface ConnectorStatus {
  id: string;
  provider: string;
  mode: string;
  lastSyncedAt: string | null;
  syncStatus: string | null;
  syncError: string | null;
  eventCount: number;
  createdAt: string;
}

interface SyncJob {
  id: string;
  status: string;
  provider: string;
  createdAt: string;
  error: string | null;
}

async function fetchConnectors(): Promise<ConnectorStatus[]> {
  try {
    return await apiFetch<ConnectorStatus[]>('/connectors');
  } catch {
    return [];
  }
}

async function fetchSyncJobs(): Promise<SyncJob[]> {
  try {
    return await apiFetch<SyncJob[]>('/connectors/sync-jobs');
  } catch {
    return [];
  }
}

export default async function ConnectorsPage(): Promise<JSX.Element> {
  const [connectors, syncJobs] = await Promise.all([fetchConnectors(), fetchSyncJobs()]);

  return (
    <>
      <TopBar
        title="Connectors"
        subtitle="Manage your data source integrations"
      />
      <div className="page-content">
        <ConnectorsGrid connectors={connectors} />

        <div className="mt-8">
          <h2 className="text-base font-semibold mb-3">Sync History</h2>
          <SyncHistoryTable jobs={syncJobs} />
        </div>
      </div>
    </>
  );
}
