import { WarRoomOpportunity } from '@nexus/contracts';
import { TopBar } from '../../components/ui/top-bar';
import { WarRoomTable } from '../../components/war-room-table';
import { formatCurrency } from '../../lib/utils';

async function fetchOpportunities(): Promise<WarRoomOpportunity[]> {
  const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
  const tenantId = process.env.SINGLE_TENANT_ID ?? 'tenant_day1';
  const authToken = process.env.AUTH_STATIC_TOKEN ?? 'day1-mvp-token';

  try {
    const response = await fetch(
      `${baseUrl}/war-room/opportunities?includeNeedsReview=true&sortBy=priority&sortDir=desc&limit=50`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'x-tenant-id': tenantId,
          'x-actor-id': 'web-war-room'
        },
        cache: 'no-store'
      }
    );

    if (!response.ok) return [];
    return (await response.json()) as WarRoomOpportunity[];
  } catch {
    return [];
  }
}

function SummaryStats({ opportunities }: { opportunities: WarRoomOpportunity[] }) {
  const recommended = opportunities.filter((o) => o.recommendationStatus === 'RECOMMENDED');
  const needsReview = opportunities.filter((o) => o.reviewStatus === 'PENDING_REVIEW');
  const totalSavings = recommended.reduce((sum, o) => sum + o.annualNetSavings, 0);
  const avgFeasibility =
    opportunities.length > 0
      ? opportunities.reduce((sum, o) => sum + o.feasibilityScore, 0) / opportunities.length
      : 0;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="stat-card">
        <span className="stat-label">Opportunities</span>
        <span className="stat-value">{opportunities.length}</span>
        <span className="stat-sub">total detected</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Recommended</span>
        <span className="stat-value">{recommended.length}</span>
        <span className="stat-sub">high-confidence</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Potential Savings</span>
        <span className="stat-value">{formatCurrency(totalSavings)}</span>
        <span className="stat-sub">annual net</span>
      </div>
      <div className="stat-card">
        <span className="stat-label">Needs Review</span>
        <span className="stat-value">{needsReview.length}</span>
        <span className="stat-sub">avg feasibility {avgFeasibility.toFixed(2)}</span>
      </div>
    </div>
  );
}

export default async function WarRoomPage(): Promise<JSX.Element> {
  const opportunities = await fetchOpportunities();

  return (
    <>
      <TopBar
        title="War Room"
        subtitle="Ranked automation opportunities from the last 30 days"
      />
      <div className="page-content">
        <SummaryStats opportunities={opportunities} />
        <WarRoomTable opportunities={opportunities} />
      </div>
    </>
  );
}
