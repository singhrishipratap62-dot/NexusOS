'use client';

import { useEffect, useState, useCallback } from 'react';
import { WarRoomOpportunity } from '@nexus/contracts';
import { TrendingUp, TrendingDown, Bot, DollarSign, Clock, Users, Zap, ChevronRight, X, Loader2, Play, AlertTriangle } from 'lucide-react';

// ──────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────
interface ExecSummary {
    totalAnnualManualCost: number;
    totalSavingsToDate: number;
    totalTimeSavedHours: number;
    activeAgentCount: number;
    activeChainCount: number;
    avgSuccessRate: number;
    totalAgentRuns: number;
    pendingAutomation: number;
    biggestOpportunity: { workflowId: string; workflowName: string; annualLaborCost: number; annualNetSavings: number } | null;
}

interface BleedCell {
    tool: string;
    totalCost: number;
    workflowCount: number;
    intensity: number;
    workflows: { workflowId: string; workflowName: string; annualLaborCost: number; workflowType: string; monthlyRuns: number; avgMinutesPerRun: number }[];
}

interface AiVsHumanRow {
    agentId: string;
    agentName: string;
    workflowName: string;
    human: { timePerTask: string; costPerTask: string; tasksToday: number; errorRate: string };
    agent: { timePerTask: string; costPerTask: string; tasksToday: number; errorRate: string };
    totalRuns: number;
    successRate: number;
}

interface WorkflowDetail {
    id: string;
    name: string;
    confidence: number;
    monthlyRuns: number;
    avgMinutesPerRun: number;
    aiAnalysis: any;
    nodes: { id: string; actor: string; tool: string; action: string; sequence: number; confidence: number }[];
    edges: { id: string; from: string; to: string; confidence: number }[];
    scoring: {
        hlcAnnualCost: number | null;
        feasibilityScore: number | null;
        feasibilityConfidence: number | null;
        rationale: any;
        roiScore: number | null;
        annualNetSavings: number | null;
        paybackMonths: number | null;
        automationCoverage: number | null;
    };
    review: { recommendationStatus: string; reviewStatus: string; reason: string | null } | null;
    automation: { blueprintId: string; blueprintName: string; status: string; dryRun: boolean; outcomes: any } | null;
}

// ──────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────
const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;
const fmtFull = (v: number) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

const toolIcons: Record<string, string> = {
    slack: '💬', gmail: '📧', gcal: '📅', github: '🔧', notion: '📝',
    linear: '📊', jira: '🎫', calendar: '📅', unknown: '🔗'
};

const toolColors: Record<string, string> = {
    slack: '#4A154B', gmail: '#EA4335', gcal: '#4285F4', github: '#24292e', notion: '#000000',
    linear: '#5E6AD2', jira: '#0052CC', calendar: '#4285F4', unknown: '#6b7280'
};

// ──────────────────────────────────────────────────
// Executive Dashboard
// ──────────────────────────────────────────────────
function ExecutiveDashboard({ summary }: { summary: ExecSummary }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
            <div style={{ padding: '20px', borderRadius: '12px', background: 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)', color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -8, top: -8, opacity: 0.15, fontSize: '64px' }}>🔥</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, opacity: 0.85, marginBottom: '8px' }}>Annual Manual Cost</div>
                <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>{fmtFull(summary.totalAnnualManualCost)}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>total unautomated labor</div>
            </div>

            <div style={{ padding: '20px', borderRadius: '12px', background: 'linear-gradient(135deg, #16a34a 0%, #166534 100%)', color: 'white', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', right: -8, top: -8, opacity: 0.15, fontSize: '64px' }}>💰</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 600, opacity: 0.85, marginBottom: '8px' }}>Savings to Date</div>
                <div style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>{fmtFull(summary.totalSavingsToDate)}</div>
                <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '4px' }}>{summary.totalTimeSavedHours}h saved · {summary.totalAgentRuns} runs</div>
            </div>

            <div className="stat-card" style={{ borderLeft: '3px solid #6366f1' }}>
                <span className="stat-label">Active Agents & Chains</span>
                <span className="stat-value">{summary.activeAgentCount} <span style={{ fontSize: '16px', color: 'var(--muted-foreground)' }}>agents</span></span>
                <span className="stat-sub">{summary.activeChainCount ?? 0} active chains · {summary.avgSuccessRate}% success</span>
            </div>

            <div className="stat-card" style={{ borderLeft: '3px solid #f59e0b' }}>
                <span className="stat-label">Pending Automation</span>
                <span className="stat-value">{summary.pendingAutomation}</span>
                <span className="stat-sub">workflows in review queue</span>
            </div>

            {summary.biggestOpportunity && (
                <div className="stat-card" style={{ borderLeft: '3px solid #ef4444' }}>
                    <span className="stat-label">💎 Biggest Opportunity</span>
                    <span className="stat-value" style={{ fontSize: '18px' }}>{fmt(summary.biggestOpportunity.annualLaborCost)}/yr</span>
                    <span className="stat-sub" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>{summary.biggestOpportunity.workflowName}</span>
                </div>
            )}
        </div>
    );
}

// ──────────────────────────────────────────────────
// Bleed Map (Treemap)
// ──────────────────────────────────────────────────
function BleedMap({ cells, onCellClick }: { cells: BleedCell[]; onCellClick: (cell: BleedCell) => void }) {
    if (cells.length === 0) return null;
    const totalCost = cells.reduce((s, c) => s + c.totalCost, 0);

    return (
        <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🗺️ The Bleed Map
                <span style={{ fontSize: '12px', fontWeight: 400, color: 'var(--muted-foreground)' }}>Where manual work costs you the most</span>
            </h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '12px', borderRadius: '12px', overflow: 'hidden' }}>
                {cells.map(cell => {
                    const pct = Math.max((cell.totalCost / totalCost) * 100, 8);
                    const bg = toolColors[cell.tool] ?? '#6b7280';
                    const intensity = cell.intensity / 100;
                    return (
                        <div
                            key={cell.tool}
                            onClick={() => onCellClick(cell)}
                            style={{
                                flex: `${pct} 0 0%`,
                                minWidth: '100px',
                                minHeight: '100px',
                                padding: '16px',
                                background: bg,
                                opacity: 0.5 + (intensity * 0.5),
                                color: 'white',
                                cursor: 'pointer',
                                position: 'relative',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'space-between',
                                transition: 'opacity 0.2s, transform 0.15s',
                                borderRadius: '4px'
                            }}
                            onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1'; (e.target as HTMLElement).style.transform = 'scale(1.02)'; }}
                            onMouseLeave={e => { (e.target as HTMLElement).style.opacity = String(0.5 + (intensity * 0.5)); (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                        >
                            <div>
                                <div style={{ fontSize: '24px', marginBottom: '4px' }}>{toolIcons[cell.tool] ?? '🔗'}</div>
                                <div style={{ fontSize: '14px', fontWeight: 700, textTransform: 'capitalize' }}>{cell.tool}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '20px', fontWeight: 800 }}>{fmtFull(cell.totalCost)}</div>
                                <div style={{ fontSize: '10px', opacity: 0.8 }}>{cell.workflowCount} workflow{cell.workflowCount !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// AI vs Human Comparison
// ──────────────────────────────────────────────────
function AiVsHumanTable({ comparisons }: { comparisons: AiVsHumanRow[] }) {
    if (comparisons.length === 0) return null;

    return (
        <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ AI vs Human Performance
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(comparisons.length, 3)}, 1fr)`, gap: '16px' }}>
                {comparisons.map(c => (
                    <div key={c.agentId} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{c.agentName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{c.workflowName} · {c.totalRuns} runs</div>
                        </div>
                        <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                                    <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', fontWeight: 600 }}>Metric</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: '#ef4444', fontWeight: 600 }}>👤 Human</th>
                                    <th style={{ padding: '8px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: '#22c55e', fontWeight: 600 }}>🤖 Agent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    { label: 'Time / task', human: c.human.timePerTask, agent: c.agent.timePerTask },
                                    { label: 'Cost / task', human: c.human.costPerTask, agent: c.agent.costPerTask },
                                    { label: 'Tasks today', human: String(c.human.tasksToday), agent: String(c.agent.tasksToday) },
                                    { label: 'Error rate', human: c.human.errorRate, agent: c.agent.errorRate }
                                ].map(row => (
                                    <tr key={row.label} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '8px 16px', fontWeight: 500 }}>{row.label}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#ef4444', fontFamily: 'monospace' }}>{row.human}</td>
                                        <td style={{ padding: '8px 12px', textAlign: 'center', color: '#22c55e', fontWeight: 600, fontFamily: 'monospace' }}>{row.agent}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// Workflow Detail Drawer
// ──────────────────────────────────────────────────
function WorkflowDrawer({ detail, onClose, onDeploy, deploying }: {
    detail: WorkflowDetail;
    onClose: () => void;
    onDeploy: (workflowId: string) => void;
    deploying: boolean;
}) {
    const analysis = detail.aiAnalysis as Record<string, any> | null;

    return (
        <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', background: 'var(--bg)', borderLeft: '1px solid var(--border)', zIndex: 1000, overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 1 }}>
                <div>
                    <h3 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>{detail.name}</h3>
                    <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        {detail.monthlyRuns} runs/mo · {detail.avgMinutesPerRun} min each · Confidence: {(detail.confidence * 100).toFixed(0)}%
                    </div>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: '4px' }}>
                    <X size={20} />
                </button>
            </div>

            <div style={{ padding: '20px 24px' }}>
                {/* DAG Visualization */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Workflow Steps</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {detail.nodes.map((node, i) => (
                            <div key={node.id}>
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px',
                                    background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)'
                                }}>
                                    <span style={{
                                        width: 28, height: 28, borderRadius: '50%', background: toolColors[node.tool] ?? '#6b7280',
                                        color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0
                                    }}>{i + 1}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{node.actor}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{node.tool}.{node.action}</div>
                                    </div>
                                    <span style={{ fontSize: '10px', color: 'var(--muted-foreground)' }}>{(node.confidence * 100).toFixed(0)}%</span>
                                </div>
                                {i < detail.nodes.length - 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
                                        <div style={{ width: '2px', height: '16px', background: 'var(--border)' }} />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Scoring Breakdown */}
                <div style={{ marginBottom: '24px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Scoring Breakdown</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {[
                            { label: 'Annual Labor Cost', value: detail.scoring.hlcAnnualCost != null ? fmtFull(detail.scoring.hlcAnnualCost) : '—' },
                            { label: 'Feasibility Score', value: detail.scoring.feasibilityScore != null ? `${(detail.scoring.feasibilityScore * 100).toFixed(0)}%` : '—' },
                            { label: 'ROI Score', value: detail.scoring.roiScore != null ? detail.scoring.roiScore.toFixed(1) : '—' },
                            { label: 'Annual Net Savings', value: detail.scoring.annualNetSavings != null ? fmtFull(detail.scoring.annualNetSavings) : '—' },
                            { label: 'Payback', value: detail.scoring.paybackMonths != null ? `${detail.scoring.paybackMonths.toFixed(1)} months` : '—' },
                            { label: 'Automation Coverage', value: detail.scoring.automationCoverage != null ? `${(detail.scoring.automationCoverage * 100).toFixed(0)}%` : '—' }
                        ].map(item => (
                            <div key={item.label} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>{item.label}</div>
                                <div style={{ fontSize: '16px', fontWeight: 700 }}>{item.value}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* AI Analysis */}
                {analysis && (
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>AI Reasoning</h4>
                        <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', lineHeight: 1.6 }}>
                            {analysis.summary || analysis.inefficiency || 'No AI analysis available.'}
                            {analysis.recommendations && analysis.recommendations.length > 0 && (
                                <div style={{ marginTop: '12px' }}>
                                    <div style={{ fontWeight: 600, marginBottom: '6px' }}>Recommendations:</div>
                                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                                        {analysis.recommendations.map((r: any, i: number) => (
                                            <li key={i} style={{ marginBottom: '4px' }}>{r.action ?? r}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Rationale */}
                {detail.scoring.rationale && (
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Feasibility Rationale</h4>
                        <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13px', lineHeight: 1.6 }}>
                            {(detail.scoring.rationale as any).summary}
                        </div>
                    </div>
                )}

                {/* Historical Performance */}
                {detail.automation && (
                    <div style={{ marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground)', margin: '0 0 12px' }}>Historical Performance</h4>
                        <div style={{ padding: '14px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
                                Agent: <strong>{detail.automation.blueprintName}</strong> ({detail.automation.status})
                            </div>
                            {detail.automation.outcomes && (
                                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                    {detail.automation.outcomes.totalRuns} runs · {detail.automation.outcomes.totalTimeSavedMinutes.toFixed(0)} min saved
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Deploy Button */}
                {!detail.automation && (
                    <button
                        onClick={() => onDeploy(detail.id)}
                        disabled={deploying}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
                            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                            color: 'white', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                        }}
                    >
                        {deploying ? <><Loader2 size={16} className="animate-spin" /> Generating Agent...</> : <><Zap size={16} /> Deploy Agent for This Workflow</>}
                    </button>
                )}
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// Deploy Preview Modal
// ──────────────────────────────────────────────────
function DeployPreviewModal({ result, onConfirm, onClose, confirming }: {
    result: any;
    onConfirm: () => void;
    onClose: () => void;
    confirming: boolean;
}) {
    const bp = result.blueprint;
    const steps = (bp.steps ?? []) as any[];

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '560px', maxHeight: '80vh', overflowY: 'auto', background: 'var(--bg)', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)' }}>
                    <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>🤖 Agent Generated</h3>
                    <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                        Confidence: {((result.confidence ?? 0.85) * 100).toFixed(0)}% · Source: {result.source ?? 'AI'}
                    </div>
                </div>

                <div style={{ padding: '20px 24px' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Name</div>
                        <div style={{ fontSize: '16px', fontWeight: 600 }}>{bp.name}</div>
                    </div>

                    {bp.description && (
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>Description</div>
                            <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{bp.description}</div>
                        </div>
                    )}

                    <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '8px' }}>Steps ({steps.length})</div>
                        {steps.map((step: any, i: number) => (
                            <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: '6px', marginBottom: '6px', border: '1px solid var(--border)' }}>
                                <span style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{step.name ?? step.action}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--muted-foreground)' }}>{step.connectorId}.{step.action}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {result.reasoning && (
                        <div style={{ padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', lineHeight: 1.5, marginBottom: '16px' }}>
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '4px' }}>AI Reasoning</div>
                            {result.reasoning}
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 24px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', fontSize: '13px', color: 'var(--foreground)' }}>Cancel</button>
                    <button onClick={onConfirm} disabled={confirming} style={{
                        padding: '10px 24px', borderRadius: '8px', border: 'none',
                        background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                        color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
                        display: 'flex', alignItems: 'center', gap: '8px'
                    }}>
                        {confirming ? <><Loader2 size={14} className="animate-spin" /> Deploying...</> : <><Play size={14} /> Confirm & Deploy</>}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// Opportunities Table (enhanced)
// ──────────────────────────────────────────────────
function OpportunitiesTable({ opportunities, onRowClick, onDeploy, deployingId }: {
    opportunities: WarRoomOpportunity[];
    onRowClick: (workflowId: string) => void;
    onDeploy: (workflowId: string) => void;
    deployingId: string | null;
}) {
    const [sortBy, setSortBy] = useState<string>('annualNetSavings');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const sorted = [...opportunities].sort((a: any, b: any) => {
        const av = a[sortBy] ?? 0;
        const bv = b[sortBy] ?? 0;
        return sortDir === 'desc' ? bv - av : av - bv;
    });

    const toggleSort = (field: string) => {
        if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortBy(field); setSortDir('desc'); }
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = { RECOMMENDED: '#22c55e', NEEDS_REVIEW: '#f59e0b', NOT_RECOMMENDED: '#ef4444' };
        return (
            <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 600, background: `${colors[status] ?? '#6b7280'}18`, color: colors[status] ?? '#6b7280' }}>
                {status.replace('_', ' ')}
            </span>
        );
    };

    return (
        <div style={{ marginBottom: '28px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 12px' }}>Ranked Automation Opportunities</h2>
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('workflowName')}>Workflow</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('feasibilityScore')}>Feasibility</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('roiScore')}>ROI</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('annualLaborCost')}>Annual Labor</th>
                            <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('annualNetSavings')}>Net Savings</th>
                            <th>Status</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map(o => (
                            <tr key={o.workflowId} style={{ cursor: 'pointer' }} onClick={() => onRowClick(o.workflowId)}>
                                <td style={{ fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.workflowName}</td>
                                <td>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <div style={{ width: 40, height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                                            <div style={{ width: `${o.feasibilityScore * 100}%`, height: '100%', borderRadius: 3, background: o.feasibilityScore > 0.7 ? '#22c55e' : o.feasibilityScore > 0.4 ? '#f59e0b' : '#ef4444' }} />
                                        </div>
                                        <span style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{(o.feasibilityScore * 100).toFixed(0)}%</span>
                                    </div>
                                </td>
                                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px' }}>{o.roiScore.toFixed(1)}</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: '#ef4444' }}>{fmtFull(o.annualLaborCost)}</td>
                                <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: '13px', color: '#22c55e', fontWeight: 600 }}>{fmtFull(o.annualNetSavings)}</td>
                                <td>{statusBadge(o.recommendationStatus)}</td>
                                <td onClick={e => e.stopPropagation()}>
                                    <button
                                        onClick={() => onDeploy(o.workflowId)}
                                        disabled={deployingId === o.workflowId}
                                        style={{
                                            padding: '5px 12px', borderRadius: '6px', border: 'none', fontSize: '11px', fontWeight: 600,
                                            background: 'var(--primary)', color: 'white', cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {deployingId === o.workflowId ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                                        Deploy
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────────────
// Main War Room Client
// ──────────────────────────────────────────────────
export default function WarRoomClient() {
    const [summary, setSummary] = useState<ExecSummary | null>(null);
    const [bleedMap, setBleedMap] = useState<{ cells: BleedCell[]; totalCost: number } | null>(null);
    const [comparisons, setComparisons] = useState<AiVsHumanRow[]>([]);
    const [opportunities, setOpportunities] = useState<WarRoomOpportunity[]>([]);
    const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
    const [deployResult, setDeployResult] = useState<any>(null);
    const [deployingId, setDeployingId] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        try {
            const [sumRes, bleedRes, aiRes, oppRes] = await Promise.all([
                fetch('/api/proxy?path=' + encodeURIComponent('/war-room/executive-summary')),
                fetch('/api/proxy?path=' + encodeURIComponent('/war-room/bleed-map')),
                fetch('/api/proxy?path=' + encodeURIComponent('/war-room/ai-vs-human')),
                fetch('/api/proxy?path=' + encodeURIComponent('/war-room/opportunities?includeNeedsReview=true&sortBy=priority&sortDir=desc&limit=50'))
            ]);
            if (sumRes.ok) setSummary(await sumRes.json());
            if (bleedRes.ok) setBleedMap(await bleedRes.json());
            if (aiRes.ok) setComparisons(await aiRes.json());
            if (oppRes.ok) setOpportunities(await oppRes.json());
        } catch { }
        setLoading(false);
    }, []);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // SSE connection for real-time updates
    useEffect(() => {
        let es: EventSource | null = null;
        try {
            es = new EventSource('/api/proxy?path=' + encodeURIComponent('/war-room/events'));
            es.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'summary_update') {
                        setSummary(data);
                    }
                } catch { }
            };
            es.onerror = () => {
                // silent reconnect handled by EventSource
            };
        } catch { }
        return () => { es?.close(); };
    }, []);

    const handleOpenDrawer = async (workflowId: string) => {
        try {
            const res = await fetch('/api/proxy?path=' + encodeURIComponent(`/war-room/workflow/${workflowId}`));
            if (res.ok) setSelectedWorkflow(await res.json());
        } catch { }
    };

    const handleDeploy = async (workflowId: string) => {
        setDeployingId(workflowId);
        try {
            const res = await fetch('/api/proxy?path=' + encodeURIComponent(`/war-room/deploy-agent/${workflowId}`), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (res.ok) {
                const result = await res.json();
                setDeployResult(result);
            }
        } catch { }
        setDeployingId(null);
    };

    const handleConfirmDeploy = async () => {
        if (!deployResult?.blueprint?.id) return;
        setConfirming(true);
        try {
            // Activate the blueprint
            await fetch('/api/proxy?path=' + encodeURIComponent(`/automation/blueprints/${deployResult.blueprint.id}`), {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'ACTIVE', dryRun: false })
            });
            setDeployResult(null);
            setSelectedWorkflow(null);
            await fetchAll();
        } catch { }
        setConfirming(false);
    };

    const handleBleedCellClick = (cell: BleedCell) => {
        // Filter opportunities to show only workflows from this tool
        if (cell.workflows.length > 0) {
            handleOpenDrawer(cell.workflows[0].workflowId);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: 'var(--muted-foreground)' }}>
                <Loader2 size={20} className="animate-spin" /> Loading War Room...
            </div>
        );
    }

    return (
        <div>
            {/* Executive Dashboard */}
            {summary && <ExecutiveDashboard summary={summary} />}

            {/* Bleed Map */}
            {bleedMap && bleedMap.cells.length > 0 && (
                <BleedMap cells={bleedMap.cells} onCellClick={handleBleedCellClick} />
            )}

            {/* AI vs Human */}
            {comparisons.length > 0 && <AiVsHumanTable comparisons={comparisons} />}

            {/* Opportunities Table */}
            <OpportunitiesTable
                opportunities={opportunities}
                onRowClick={handleOpenDrawer}
                onDeploy={handleDeploy}
                deployingId={deployingId}
            />

            {/* Workflow Detail Drawer */}
            {selectedWorkflow && (
                <>
                    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 999 }} onClick={() => setSelectedWorkflow(null)} />
                    <WorkflowDrawer
                        detail={selectedWorkflow}
                        onClose={() => setSelectedWorkflow(null)}
                        onDeploy={handleDeploy}
                        deploying={deployingId !== null}
                    />
                </>
            )}

            {/* Deploy Preview Modal */}
            {deployResult && (
                <DeployPreviewModal
                    result={deployResult}
                    onConfirm={handleConfirmDeploy}
                    onClose={() => setDeployResult(null)}
                    confirming={confirming}
                />
            )}
        </div>
    );
}
