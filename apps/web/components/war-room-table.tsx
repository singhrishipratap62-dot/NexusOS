'use client';

import { useMemo, useState, useCallback } from 'react';
import { WarRoomOpportunity } from '@nexus/contracts';
import {
  filterOpportunities,
  sortOpportunities,
  WarRoomRecommendationFilter,
  WarRoomReviewStatusFilter,
  WarRoomSortBy,
  WarRoomSortDirection
} from './ranking';
import { Sparkles, Bot, ChevronDown, ChevronUp, Loader2, Zap } from 'lucide-react';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

function scoreClass(value: number): string {
  if (value >= 0.75) return 'score score-good';
  if (value >= 0.55) return 'score score-mid';
  return 'score score-low';
}

interface AiAnalysis {
  inefficiency?: string;
  rootCause?: string;
  impact?: { hoursWastedPerWeek?: number; affectedPeople?: number; severity?: string };
  recommendations?: Array<{ action?: string; effort?: string; expectedImprovement?: string }>;
  summary?: string;
}

export function WarRoomTable({ opportunities }: { opportunities: WarRoomOpportunity[] }): JSX.Element {
  const [recommendationFilter, setRecommendationFilter] = useState<WarRoomRecommendationFilter>('ALL');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<WarRoomReviewStatusFilter>('ALL');
  const [sortBy, setSortBy] = useState<WarRoomSortBy>('annualNetSavings');
  const [sortDirection, setSortDirection] = useState<WarRoomSortDirection>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, AiAnalysis>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<string | null>(null);
  const [generatingBlueprint, setGeneratingBlueprint] = useState<string | null>(null);
  const [blueprintResult, setBlueprintResult] = useState<Record<string, any>>({});

  const ranked = useMemo(() => {
    const filtered = filterOpportunities(opportunities, {
      includeNeedsReview: true,
      recommendationFilter,
      reviewStatusFilter
    });
    return sortOpportunities(filtered, { sortBy, sortDirection });
  }, [opportunities, recommendationFilter, reviewStatusFilter, sortBy, sortDirection]);

  const handleAnalyze = useCallback(async (workflowId: string) => {
    setLoadingAnalysis(workflowId);
    setExpandedRow(workflowId);
    try {
      const res = await fetch(`/api/proxy?path=${encodeURIComponent(`/ai/analyze/${workflowId}`)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.analysis) {
        setAnalyses(prev => ({ ...prev, [workflowId]: data.analysis }));
      }
    } catch (err) {
      console.error('Analysis failed:', err);
    } finally {
      setLoadingAnalysis(null);
    }
  }, []);

  const handleGenerateBlueprint = useCallback(async (workflowId: string) => {
    setGeneratingBlueprint(workflowId);
    try {
      const res = await fetch(`/api/proxy?path=${encodeURIComponent(`/ai/generate-blueprint/${workflowId}`)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      setBlueprintResult(prev => ({ ...prev, [workflowId]: data }));
    } catch (err) {
      console.error('Blueprint generation failed:', err);
    } finally {
      setGeneratingBlueprint(null);
    }
  }, []);

  return (
    <section className="war-room-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">War Room</p>
          <h2>Ranked Automation Opportunities</h2>
        </div>
        <div className="filters" role="tablist" aria-label="Opportunity filter">
          <button type="button" onClick={() => setRecommendationFilter('ALL')} className={recommendationFilter === 'ALL' ? 'active' : ''}>All</button>
          <button type="button" onClick={() => setRecommendationFilter('RECOMMENDED')} className={recommendationFilter === 'RECOMMENDED' ? 'active' : ''}>Recommended</button>
          <button type="button" onClick={() => setRecommendationFilter('NEEDS_REVIEW')} className={recommendationFilter === 'NEEDS_REVIEW' ? 'active' : ''}>Needs Review</button>
        </div>
      </div>

      <div className="controls">
        <label>
          Review Status
          <select value={reviewStatusFilter} onChange={(e) => setReviewStatusFilter(e.target.value as WarRoomReviewStatusFilter)}>
            <option value="ALL">All</option>
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="AUTO_APPROVED">Auto Approved</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </label>
        <label>
          Sort By
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as WarRoomSortBy)}>
            <option value="priority">Priority</option>
            <option value="annualNetSavings">Annual Net Savings</option>
            <option value="annualLaborCost">Annual Labor Cost</option>
            <option value="roiScore">ROI Score</option>
            <option value="feasibilityScore">Feasibility Score</option>
            <option value="workflowConfidence">Workflow Confidence</option>
          </select>
        </label>
        <button type="button" className="sort-direction" onClick={() => setSortDirection(c => c === 'desc' ? 'asc' : 'desc')}>
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
              <th>AI Actions</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((item) => (
              <>
                <tr key={item.workflowId} style={{ cursor: 'pointer' }} onClick={() => setExpandedRow(expandedRow === item.workflowId ? null : item.workflowId)}>
                  <td>
                    <div className="workflow-name" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {expandedRow === item.workflowId ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      {item.workflowName}
                      {analyses[item.workflowId] && <Sparkles size={14} style={{ color: 'var(--primary)' }} />}
                    </div>
                    <small style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                      {item.workflowName.toLowerCase().startsWith('slack') && <span title="Slack" style={{ fontSize: '11px' }}>💬</span>}
                      {item.workflowName.toLowerCase().startsWith('gmail') && <span title="Gmail" style={{ fontSize: '11px' }}>📧</span>}
                      {item.workflowName.toLowerCase().startsWith('gcal') && <span title="Calendar" style={{ fontSize: '11px' }}>📅</span>}
                      {item.workflowName.toLowerCase().startsWith('customer') && <span title="Gmail" style={{ fontSize: '11px' }}>📧</span>}
                      <span style={{ color: 'var(--muted-foreground)' }}>
                        ~{item.monthlyRuns ?? 0}x/mo
                      </span>
                      <span style={{ color: 'var(--muted-foreground)' }}>{item.recommendationStatus}</span>
                    </small>
                  </td>
                  <td>
                    <span className={scoreClass(item.feasibilityScore)}>{item.feasibilityScore.toFixed(2)}</span>
                  </td>
                  <td><span className={scoreClass(item.roiScore)}>{item.roiScore.toFixed(2)}</span></td>
                  <td>{formatCurrency(item.annualLaborCost)}</td>
                  <td>{formatCurrency(item.annualNetSavings)}</td>
                  <td>{item.paybackMonths === null ? 'N/A' : `${item.paybackMonths.toFixed(1)} mo`}</td>
                  <td>
                    <small>workflow: {item.workflowConfidence.toFixed(2)}</small>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        className="btn-sm"
                        onClick={() => handleAnalyze(item.workflowId)}
                        disabled={loadingAnalysis === item.workflowId}
                        title="Analyze with AI"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--foreground)' }}
                      >
                        {loadingAnalysis === item.workflowId ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        Analyze
                      </button>
                      <button
                        className="btn-sm"
                        onClick={() => handleGenerateBlueprint(item.workflowId)}
                        disabled={generatingBlueprint === item.workflowId}
                        title="Generate Agent"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid var(--primary)', background: 'var(--primary)', color: 'white', cursor: 'pointer' }}
                      >
                        {generatingBlueprint === item.workflowId ? <Loader2 size={12} className="animate-spin" /> : <Bot size={12} />}
                        Generate Agent
                      </button>
                    </div>
                  </td>
                </tr>

                {expandedRow === item.workflowId && (
                  <tr key={`${item.workflowId}-detail`}>
                    <td colSpan={8}>
                      <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', margin: '4px 0 8px' }}>
                        {loadingAnalysis === item.workflowId && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--muted-foreground)' }}>
                            <Loader2 size={16} className="animate-spin" />
                            Analyzing workflow with AI...
                          </div>
                        )}

                        {analyses[item.workflowId] && (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                              <strong style={{ fontSize: '14px' }}>AI Analysis</strong>
                            </div>

                            {analyses[item.workflowId].inefficiency && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Inefficiency</div>
                                <div style={{ fontSize: '14px', fontWeight: 500 }}>{analyses[item.workflowId].inefficiency}</div>
                              </div>
                            )}

                            {analyses[item.workflowId].rootCause && (
                              <div style={{ marginBottom: '8px' }}>
                                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Root Cause</div>
                                <div style={{ fontSize: '13px' }}>{analyses[item.workflowId].rootCause}</div>
                              </div>
                            )}

                            {analyses[item.workflowId].impact && (
                              <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                                <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: '6px', fontSize: '12px' }}>
                                  <strong>{analyses[item.workflowId].impact?.hoursWastedPerWeek}h</strong>/week wasted
                                </div>
                                <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: '6px', fontSize: '12px' }}>
                                  <strong>{analyses[item.workflowId].impact?.affectedPeople}</strong> people affected
                                </div>
                                <div style={{ padding: '8px 12px', background: 'var(--bg)', borderRadius: '6px', fontSize: '12px' }}>
                                  Severity: <strong>{analyses[item.workflowId].impact?.severity}</strong>
                                </div>
                              </div>
                            )}

                            {analyses[item.workflowId].summary && (
                              <div style={{ fontSize: '13px', color: 'var(--muted-foreground)', marginTop: '8px', lineHeight: 1.5 }}>
                                {analyses[item.workflowId].summary}
                              </div>
                            )}
                          </div>
                        )}

                        {!analyses[item.workflowId] && !loadingAnalysis && (
                          <div style={{ color: 'var(--muted-foreground)', fontSize: '13px' }}>
                            Click &quot;Analyze&quot; to get AI-powered insights about this workflow.
                          </div>
                        )}

                        {blueprintResult[item.workflowId] && (
                          <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                              <Zap size={16} style={{ color: 'var(--primary)' }} />
                              <strong style={{ fontSize: '14px' }}>Agent Blueprint Generated</strong>
                            </div>
                            <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                              <strong>{blueprintResult[item.workflowId].blueprint?.name}</strong>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                              {blueprintResult[item.workflowId].blueprint?.description || blueprintResult[item.workflowId].reasoning}
                            </div>
                            <div style={{ fontSize: '11px', marginTop: '4px', color: 'var(--muted-foreground)' }}>
                              Confidence: {((blueprintResult[item.workflowId].confidence ?? 0) * 100).toFixed(0)}% • Source: {blueprintResult[item.workflowId].source}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
