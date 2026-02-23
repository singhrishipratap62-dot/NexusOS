'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

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

function ReviewStatusBadge({ status }: { status: string }) {
  if (status === 'PENDING_REVIEW') {
    return (
      <span className="badge badge-warning flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Pending
      </span>
    );
  }
  if (status === 'APPROVED') {
    return (
      <span className="badge badge-success flex items-center gap-1">
        <CheckCircle className="w-3 h-3" />
        Approved
      </span>
    );
  }
  if (status === 'REJECTED') {
    return (
      <span className="badge badge-destructive flex items-center gap-1">
        <XCircle className="w-3 h-3" />
        Rejected
      </span>
    );
  }
  return <span className="badge badge-secondary">{status}</span>;
}

function DecisionModal({
  item,
  action,
  onClose,
  onSubmit
}: {
  item: ReviewItem;
  action: 'APPROVE' | 'REJECT';
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card max-w-md w-full p-6">
        <h3 className="font-semibold mb-1">
          {action === 'APPROVE' ? 'Approve' : 'Reject'} Workflow
        </h3>
        <p className="text-sm text-muted-foreground mb-4">{item.workflow.name}</p>
        <textarea
          className="input min-h-[100px] resize-none mb-4"
          placeholder={
            action === 'APPROVE'
              ? 'Optional: note any conditions or caveats...'
              : 'Required: explain why this workflow should not be automated...'
          }
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={action === 'APPROVE' ? 'btn-primary text-sm' : 'btn-destructive text-sm'}
            onClick={() => onSubmit(reason)}
            disabled={action === 'REJECT' && !reason.trim()}
          >
            {action === 'APPROVE' ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReviewQueueTable({
  items,
  showActions
}: {
  items: ReviewItem[];
  showActions: boolean;
}) {
  const [modal, setModal] = useState<{ item: ReviewItem; action: 'APPROVE' | 'REJECT' } | null>(
    null
  );
  const [processing, setProcessing] = useState<string | null>(null);

  const handleDecision = async (item: ReviewItem, decision: 'APPROVE' | 'REJECT', reason: string) => {
    setProcessing(item.id);
    setModal(null);

    try {
      await fetch(`/api/review/${item.workflowId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
          reason: reason || undefined
        })
      });
      // In a real app, invalidate cache / refetch
      window.location.reload();
    } catch (err) {
      console.error('Decision failed:', err);
    } finally {
      setProcessing(null);
    }
  };

  return (
    <>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Workflow</th>
                <th>Confidence</th>
                <th>Monthly Runs</th>
                <th>Avg Duration</th>
                <th>Status</th>
                {showActions && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="font-medium text-sm">{item.workflow.name}</div>
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {item.recommendationStatus}
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-sm">
                      {item.workflow.confidence.toFixed(2)}
                    </span>
                  </td>
                  <td className="font-mono text-sm">{item.workflow.monthlyRuns}×/mo</td>
                  <td className="font-mono text-sm">{item.workflow.avgMinutesPerRun} min</td>
                  <td>
                    <ReviewStatusBadge status={item.reviewStatus} />
                    {item.reason && (
                      <p className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate">
                        {item.reason}
                      </p>
                    )}
                  </td>
                  {showActions && (
                    <td>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="btn-primary text-xs px-2 py-1"
                          disabled={processing === item.id}
                          onClick={() => setModal({ item, action: 'APPROVE' })}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Approve
                        </button>
                        <button
                          type="button"
                          className="btn-destructive text-xs px-2 py-1"
                          disabled={processing === item.id}
                          onClick={() => setModal({ item, action: 'REJECT' })}
                        >
                          <XCircle className="w-3 h-3" />
                          Reject
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <DecisionModal
          item={modal.item}
          action={modal.action}
          onClose={() => setModal(null)}
          onSubmit={(reason) => handleDecision(modal.item, modal.action, reason)}
        />
      )}
    </>
  );
}
