import { TopBar } from '../../components/ui/top-bar';
import { ConnectorsGrid } from '../../components/connectors-grid';

interface ConnectorStatus {
  id: string;
  provider: string;
  mode: string;
  lastSyncedAt: string | null;
  createdAt: string;
}

async function fetchConnectors(): Promise<ConnectorStatus[]> {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
  const tenantId = process.env.SINGLE_TENANT_ID ?? 'tenant_day1';
  const authToken = process.env.AUTH_STATIC_TOKEN ?? 'day1-mvp-token';

  try {
    // In a real implementation, we'd have a GET /connectors endpoint.
    // For now we build a status view from what we know.
    const response = await fetch(`${baseUrl}/connectors`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'x-tenant-id': tenantId,
        'x-actor-id': 'web-connectors'
      },
      cache: 'no-store'
    });

    if (!response.ok) return [];
    return (await response.json()) as ConnectorStatus[];
  } catch {
    return [];
  }
}

export default async function ConnectorsPage(): Promise<JSX.Element> {
  const connectors = await fetchConnectors();

  return (
    <>
      <TopBar
        title="Connectors"
        subtitle="Manage your data source integrations"
      />
      <div className="page-content">
        <ConnectorsGrid connectors={connectors} />
      </div>
    </>
  );
}
