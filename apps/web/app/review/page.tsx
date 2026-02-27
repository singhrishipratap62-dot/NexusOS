'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../components/ui/top-bar';
import { ReviewQueueTable } from '../../components/review-queue-table';
import { clientApiFetch as apiFetch } from '../../lib/api-client';

interface ReviewItem {
  id: string;
  workflowId: string;
  recommendationStatus: string;
  reviewStatus: string;
  reason: string | null;
  reviewedAt: string | null;
  createdAt: string;
  workflow: {
    id: string;
    name: string;
    confidence: number;
    monthlyRuns: number;
    avgMinutesPerRun: number;
  };
}

async function fetchReviewQueue(): Promise<ReviewItem[]> {
  try {
    return await apiFetch<ReviewItem[]>('/review-queue');
  } catch {
    return [];
  }
}

export default async function ReviewPage(): Promise<JSX.Element> {
  const items = await fetchReviewQueue();
  const pending = items.filter((i) => i.reviewStatus === 'PENDING_REVIEW');
  const reviewed = items.filter((i) => i.reviewStatus !== 'PENDING_REVIEW');

  return (
    <>
      <TopBar
        title="Review Queue"
        subtitle={`${pending.length} items pending analyst review`}
      />
      <div className="page-content">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="stat-card">
            <span className="stat-label">Pending Review</span>
            <span className="stat-value">{pending.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Approved</span>
            <span className="stat-value">
              {items.filter((i) => i.reviewStatus === 'APPROVED').length}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Rejected</span>
            <span className="stat-value">
              {items.filter((i) => i.reviewStatus === 'REJECTED').length}
            </span>
          </div>
        </div>

        {pending.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-3">Pending Review</h2>
            <ReviewQueueTable items={pending} showActions />
          </div>
        )}

        {reviewed.length > 0 && (
          <div>
            <h2 className="text-base font-semibold mb-3">Decision History</h2>
            <ReviewQueueTable items={reviewed} showActions={false} />
          </div>
        )}

        {items.length === 0 && (
          <div className="card p-12 text-center">
            <p className="text-muted-foreground">No items in review queue.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Items with workflow confidence &lt; 0.70 will appear here.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
