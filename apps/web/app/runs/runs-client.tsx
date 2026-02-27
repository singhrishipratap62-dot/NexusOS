'use client';

import React, { useState } from 'react';
import {
    Play,
    Pause,
    XCircle,
    CheckCircle,
    Clock,
    AlertCircle,
    Loader2,
    ChevronDown,
    ChevronRight,
    Zap,
    FileText,
    Sparkles,
    Bot,
    Shield,
    TrendingUp
} from 'lucide-react';

interface Blueprint {
    id: string;
    name: string;
    description: string | null;
    status: string;
    triggerType: string;
    dryRun: boolean;
    steps: any[];
    aiGenerated: boolean;
    aiReasoning: string | null;
    autoExecute: boolean;
    confidenceThreshold: number;
    createdAt: string;
    updatedAt: string;
}

interface Run {
    id: string;
    blueprintId: string;
    status: string;
    triggeredBy: string;
    dryRun: boolean;
    stepResults: any[] | null;
    logs: string[] | null;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
    createdAt: string;
}

interface Outcomes {
    totalRuns: number;
    activeBlueprints: number;
    totalTimeSavedMinutes: number;
    totalTimeSavedHours: number;
    estimatedAnnualSavingsHours: number;
}

function BlueprintStatusBadge({ status }: { status: string }) {
    const map: Record<string, { icon: React.ReactNode; className: string }> = {
        DRAFT: { icon: <FileText className="w-3 h-3" />, className: 'badge badge-secondary' },
        ACTIVE: { icon: <Play className="w-3 h-3" />, className: 'badge badge-success' },
        PAUSED: { icon: <Pause className="w-3 h-3" />, className: 'badge badge-warning' },
        ARCHIVED: { icon: <XCircle className="w-3 h-3" />, className: 'badge badge-secondary' }
    };
    const config = map[status] ?? map.DRAFT;
    return (
        <span className={`${config.className} flex items-center gap-1`}>
            {config.icon}
            {status}
        </span>
    );
}

function RunStatusBadge({ status }: { status: string }) {
    const map: Record<string, { icon: React.ReactNode; className: string }> = {
        QUEUED: { icon: <Clock className="w-3 h-3" />, className: 'badge badge-secondary' },
        RUNNING: { icon: <Loader2 className="w-3 h-3 animate-spin" />, className: 'badge badge-warning' },
        SUCCEEDED: { icon: <CheckCircle className="w-3 h-3" />, className: 'badge badge-success' },
        FAILED: { icon: <XCircle className="w-3 h-3" />, className: 'badge badge-destructive' },
        CANCELLED: { icon: <AlertCircle className="w-3 h-3" />, className: 'badge badge-secondary' },
        WAITING_HITL: { icon: <Shield className="w-3 h-3" />, className: 'badge badge-warning' }
    };
    const config = map[status] ?? map.QUEUED;
    return (
        <span className={`${config.className} flex items-center gap-1`}>
            {config.icon}
            {status === 'WAITING_HITL' ? 'Awaiting Approval' : status}
        </span>
    );
}

function RunDetail({ run, onApproveStep }: { run: Run; onApproveStep: (runId: string, stepIndex: number) => void }) {
    const [expanded, setExpanded] = useState(false);

    return (
        <tr key={run.id}>
            <td colSpan={7}>
                <div className="p-3">
                    <button
                        type="button"
                        className="flex items-center gap-2 text-sm font-medium w-full text-left"
                        onClick={() => setExpanded(!expanded)}
                    >
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        Run {run.id.slice(0, 8)}…
                        <RunStatusBadge status={run.status} />
                        {run.dryRun && <span className="badge badge-secondary text-xs">DRY RUN</span>}
                        <span className="ml-auto text-xs text-muted-foreground font-mono">
                            {new Date(run.createdAt).toLocaleString()}
                        </span>
                    </button>

                    {expanded && (
                        <div className="mt-3 space-y-3">
                            {run.status === 'WAITING_HITL' && (
                                <div style={{
                                    padding: '12px 16px', borderRadius: '8px',
                                    background: 'rgba(234, 179, 8, 0.1)',
                                    border: '1px solid rgba(234, 179, 8, 0.3)',
                                    display: 'flex', alignItems: 'center', gap: '12px'
                                }}>
                                    <Shield className="w-5 h-5" style={{ color: '#eab308' }} />
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', fontWeight: 600 }}>Human Approval Required</div>
                                        <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                            This run is paused, waiting for your approval to continue execution.
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        className="btn-primary text-xs"
                                        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                        onClick={() => {
                                            const nextStep = (run.stepResults?.length ?? 0);
                                            onApproveStep(run.id, nextStep);
                                        }}
                                    >
                                        <CheckCircle className="w-3 h-3" />
                                        Approve & Continue
                                    </button>
                                </div>
                            )}

                            {run.error && (
                                <div className="auth-error text-xs">{run.error}</div>
                            )}

                            {run.stepResults && run.stepResults.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Step Results</h4>
                                    <div className="space-y-1">
                                        {run.stepResults.map((step: any, i: number) => (
                                            <div
                                                key={i}
                                                className="flex items-center gap-2 text-xs font-mono p-2 rounded-md"
                                                style={{ background: 'var(--color-muted)' }}
                                            >
                                                {step.status === 'succeeded' || step.status === 'dry_run' ? (
                                                    <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
                                                ) : step.status === 'waiting_approval' ? (
                                                    <Shield className="w-3 h-3 flex-shrink-0" style={{ color: '#eab308' }} />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                                                )}
                                                <span className="font-medium">{step.action}</span>
                                                <span className="text-muted-foreground">→ {step.status}</span>
                                                <span className="ml-auto text-muted-foreground">{step.durationMs}ms</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {run.logs && run.logs.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-muted-foreground mb-2">Logs</h4>
                                    <pre
                                        className="text-xs font-mono p-3 rounded-md overflow-x-auto"
                                        style={{
                                            background: 'var(--color-muted)',
                                            maxHeight: '200px',
                                            overflowY: 'auto'
                                        }}
                                    >
                                        {run.logs.join('\n')}
                                    </pre>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

function OutcomesPanel({ outcomes }: { outcomes: Outcomes | null }) {
    if (!outcomes || outcomes.totalRuns === 0) return null;

    return (
        <div className="mb-6">
            <h2 className="text-base font-semibold mb-3" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                Automation Outcomes
            </h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat-card">
                    <span className="stat-label">Time Saved</span>
                    <span className="stat-value">{outcomes.totalTimeSavedHours}h</span>
                    <span className="stat-sub">total hours recovered</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Runs Completed</span>
                    <span className="stat-value">{outcomes.totalRuns}</span>
                    <span className="stat-sub">automation executions</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Active Agents</span>
                    <span className="stat-value">{outcomes.activeBlueprints}</span>
                    <span className="stat-sub">blueprints with runs</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Annual Savings</span>
                    <span className="stat-value">{outcomes.estimatedAnnualSavingsHours}h</span>
                    <span className="stat-sub">projected yearly</span>
                </div>
            </div>
        </div>
    );
}

export function RunsPageClient({
    blueprints,
    runs,
    outcomes
}: {
    blueprints: Blueprint[];
    runs: Run[];
    outcomes: Outcomes | null;
}) {
    const [running, setRunning] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [approving, setApproving] = useState<string | null>(null);

    const handleRun = async (blueprintId: string) => {
        setRunning(blueprintId);
        try {
            await fetch(`/api/proxy?path=/automation/blueprints/${blueprintId}/run`, { method: 'POST' });
            window.location.reload();
        } catch (err) {
            console.error('Failed to trigger run:', err);
        } finally {
            setRunning(null);
        }
    };

    const handleCancel = async (runId: string) => {
        setCancelling(runId);
        try {
            await fetch(`/api/proxy?path=/automation/runs/${runId}/cancel`, { method: 'POST' });
            window.location.reload();
        } catch (err) {
            console.error('Failed to cancel run:', err);
        } finally {
            setCancelling(null);
        }
    };

    const handleApproveStep = async (runId: string, stepIndex: number) => {
        setApproving(runId);
        try {
            await fetch(`/api/proxy?path=/automation/runs/${runId}/approve-step/${stepIndex}`, { method: 'POST' });
            window.location.reload();
        } catch (err) {
            console.error('Failed to approve step:', err);
        } finally {
            setApproving(null);
        }
    };

    const blueprintMap = Object.fromEntries(blueprints.map((b) => [b.id, b]));

    return (
        <>
            {/* Outcomes Dashboard */}
            <OutcomesPanel outcomes={outcomes} />

            {/* Blueprints Section */}
            <div className="mb-6">
                <h2 className="text-base font-semibold mb-3">Blueprints</h2>
                {blueprints.length === 0 ? (
                    <div className="card p-8 text-center">
                        <div className="flex justify-center mb-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Zap className="w-5 h-5 text-primary" />
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            No automation blueprints yet. Go to the War Room and click &quot;Generate Agent&quot; to create one.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {blueprints.map((bp) => (
                            <div key={bp.id} className="card p-4">
                                <div className="flex items-start justify-between mb-2">
                                    <div>
                                        <div className="font-semibold text-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            {bp.aiGenerated && <Bot className="w-3.5 h-3.5" style={{ color: 'var(--primary)' }} />}
                                            {bp.name}
                                        </div>
                                        {bp.description && (
                                            <div className="text-xs text-muted-foreground mt-0.5">{bp.description}</div>
                                        )}
                                    </div>
                                    <BlueprintStatusBadge status={bp.status} />
                                </div>

                                <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono mb-2">
                                    <span>{bp.triggerType}</span>
                                    <span>·</span>
                                    <span>{bp.steps?.length ?? 0} steps</span>
                                    {bp.dryRun && (
                                        <>
                                            <span>·</span>
                                            <span className="text-primary">Dry-run</span>
                                        </>
                                    )}
                                </div>

                                {/* AI badges row */}
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                    {bp.aiGenerated && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            padding: '2px 8px', fontSize: '10px', borderRadius: '10px',
                                            background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)',
                                            fontWeight: 600
                                        }}>
                                            <Sparkles size={10} /> AI Generated
                                        </span>
                                    )}
                                    {bp.autoExecute && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            padding: '2px 8px', fontSize: '10px', borderRadius: '10px',
                                            background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                                            fontWeight: 600
                                        }}>
                                            <Zap size={10} /> Auto-Execute
                                        </span>
                                    )}
                                    {bp.confidenceThreshold > 0 && (
                                        <span style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '3px',
                                            padding: '2px 8px', fontSize: '10px', borderRadius: '10px',
                                            background: 'var(--color-muted)',
                                            fontWeight: 500
                                        }}>
                                            <Shield size={10} /> {(bp.confidenceThreshold * 100).toFixed(0)}% gate
                                        </span>
                                    )}
                                </div>

                                {/* AI Reasoning snippet */}
                                {bp.aiReasoning && (
                                    <div style={{
                                        fontSize: '11px', color: 'var(--muted-foreground)',
                                        marginBottom: '10px', lineHeight: 1.4,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden'
                                    }}>
                                        💡 {bp.aiReasoning}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    className="btn-primary text-xs w-full flex items-center justify-center gap-2"
                                    onClick={() => handleRun(bp.id)}
                                    disabled={running === bp.id}
                                >
                                    {running === bp.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Play className="w-3 h-3" />
                                    )}
                                    {running === bp.id ? 'Triggering...' : 'Run Now'}
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Runs Section */}
            <div>
                <h2 className="text-base font-semibold mb-3">Recent Runs</h2>
                {runs.length === 0 ? (
                    <div className="card p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            No runs yet. Trigger a blueprint to see execution results here.
                        </p>
                    </div>
                ) : (
                    <div className="card overflow-hidden">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Blueprint</th>
                                    <th>Status</th>
                                    <th>Mode</th>
                                    <th>Source</th>
                                    <th>Started</th>
                                    <th>Duration</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {runs.map((run) => {
                                    const bp = blueprintMap[run.blueprintId];
                                    const durationMs =
                                        run.startedAt && run.finishedAt
                                            ? new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
                                            : null;

                                    return (
                                        <React.Fragment key={run.id}>
                                            <tr>
                                                <td className="font-medium text-sm">
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        {bp?.aiGenerated && <Bot className="w-3 h-3" style={{ color: 'var(--primary)' }} />}
                                                        {bp?.name ?? run.blueprintId.slice(0, 8)}
                                                    </span>
                                                </td>
                                                <td><RunStatusBadge status={run.status} /></td>
                                                <td>
                                                    <span className="text-xs font-mono">
                                                        {run.dryRun ? '🧪 Dry-run' : '⚡ Live'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <span className="text-xs font-mono">
                                                        {bp?.aiGenerated ? '🤖 AI' : '👤 Manual'}
                                                    </span>
                                                </td>
                                                <td className="font-mono text-xs text-muted-foreground">
                                                    {run.startedAt ? new Date(run.startedAt).toLocaleString() : '—'}
                                                </td>
                                                <td className="font-mono text-xs text-muted-foreground">
                                                    {durationMs !== null ? `${durationMs}ms` : '—'}
                                                </td>
                                                <td>
                                                    <div style={{ display: 'flex', gap: '6px' }}>
                                                        {run.status === 'WAITING_HITL' && (
                                                            <button
                                                                type="button"
                                                                className="btn-primary text-xs"
                                                                onClick={() => handleApproveStep(run.id, run.stepResults?.length ?? 0)}
                                                                disabled={approving === run.id}
                                                                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                {approving === run.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                                                                Approve
                                                            </button>
                                                        )}
                                                        {(run.status === 'QUEUED' || run.status === 'RUNNING') && (
                                                            <button
                                                                type="button"
                                                                className="btn-destructive text-xs"
                                                                onClick={() => handleCancel(run.id)}
                                                                disabled={cancelling === run.id}
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            <RunDetail run={run} onApproveStep={handleApproveStep} />
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
