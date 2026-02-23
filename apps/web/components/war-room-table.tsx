'use client';

import { useMemo, useState } from 'react';
import { WarRoomOpportunity } from '@nexus/contracts';
import {
  filterOpportunities,
  sortOpportunities,
  WarRoomRecommendationFilter,
  WarRoomReviewStatusFilter,
  WarRoomSortBy,
  WarRoomSortDirection
} from './ranking';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function scoreClass(value: number): string {
  if (value >= 0.75) {
    return 'score score-good';
  }
  if (value >= 0.55) {
    return 'score score-mid';
  }
  return 'score score-low';
}

export function WarRoomTable({ opportunities }: { opportunities: WarRoomOpportunity[] }): JSX.Element {
  const [recommendationFilter, setRecommendationFilter] = useState<WarRoomRecommendationFilter>('ALL');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<WarRoomReviewStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<WarRoomSortBy>('priority');
  const [sortDirection, setSortDirection] = useState<WarRoomSortDirection>('desc');

  const ranked = useMemo(() => {
    const filtered = filterOpportunities(opportunities, {
      includeNeedsReview: true,
      recommendationFilter,
      reviewStatusFilter
    });

    return sortOpportunities(filtered, {
      sortBy,
      sortDirection
    });
  }, [opportunities, recommendationFilter, reviewStatusFilter, sortBy, sortDirection]);

  return (
    <section className="war-room-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">War Room</p>
          <h2>Ranked Automation Opportunities</h2>
        </div>
        <div className="filters" role="tablist" aria-label="Opportunity filter">
          <button
            type="button"
            onClick={() => setRecommendationFilter('ALL')}
            className={recommendationFilter === 'ALL' ? 'active' : ''}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setRecommendationFilter('RECOMMENDED')}
            className={recommendationFilter === 'RECOMMENDED' ? 'active' : ''}
          >
            Recommended
          </button>
          <button
            type="button"
            onClick={() => setRecommendationFilter('NEEDS_REVIEW')}
            className={recommendationFilter === 'NEEDS_REVIEW' ? 'active' : ''}
          >
            Needs Review
          </button>
        </div>
      </div>

      <div className="controls">
        <label>
          Review Status
          <select
            value={reviewStatusFilter}
            onChange={(event) => setReviewStatusFilter(event.target.value as WarRoomReviewStatusFilter)}
          >
            <option value="ALL">All</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="AUTO_APPROVED">Auto Approved</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label>
          Sort By
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as WarRoomSortBy)}
          >
            <option value="priority">Priority</option>
            <option value="annualNetSavings">Annual Net Savings</option>
            <option value="annualLaborCost">Annual Labor Cost</option>
            <option value="roiScore">ROI Score</option>
            <option value="feasibilityScore">Feasibility Score</option>
            <option value="workflowConfidence">Workflow Confidence</option>
          </select>
        </label>
        <button
          type="button"
          className="sort-direction"
          onClick={() => setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))}
        >
          Direction: {sortDirection.toUpperCase()}
        </button>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Workflow</th>
              <th>Feasibility</th>
              <th>ROI</th>
              <th>Annual Labor</th>
              <th>Net Savings</th>
              <th>Payback</th>
              <th>Confidence</th>
              <th>Review Gate</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((item) => (
              <tr key={item.workflowId}>
                <td>
                  <div className="workflow-name">{item.workflowName}</div>
                  <small>{item.recommendationStatus}</small>
                </td>
                <td>
                  <span className={scoreClass(item.feasibilityScore)}>{item.feasibilityScore.toFixed(2)}</span>
                  <small>conf: {item.feasibilityConfidence.toFixed(2)}</small>
                </td>
                <td>
                  <span className={scoreClass(item.roiScore)}>{item.roiScore.toFixed(2)}</span>
                </td>
                <td>{formatCurrency(item.annualLaborCost)}</td>
                <td>{formatCurrency(item.annualNetSavings)}</td>
                <td>{item.paybackMonths === null ? 'N/A' : `${item.paybackMonths.toFixed(1)} mo`}</td>
                <td>
                  <small>workflow: {item.workflowConfidence.toFixed(2)}</small>
                  <small>feasibility: {item.feasibilityConfidence.toFixed(2)}</small>
                </td>
                <td>
                  <strong>{item.reviewStatus}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
