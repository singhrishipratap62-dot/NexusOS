'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Loader2, Pause, Play, RefreshCw } from 'lucide-react';

interface AgentDetail {
    id: string;
    name: string;
    description: string | null;
    workflowId: string | null;
    status: string;
    currentStatus: string;
    triggerType: string;
    triggerConfig: Record<string, any> | null;
    steps: any[];
    dryRun: boolean;
    autoExecute: boolean;
    confidenceThreshold: number;
    aiGenerated: boolean;
    aiReasoning: string | null;
    persona: string | null;
    avatarUrl: string | null;
    jobTitle: string | null;
    department: string | null;
    manager: string | null;
    totalRuns: number;
    successRate: number;
    totalTimeSavedMinutes: number;
    totalTimeSavedHours: number;
    totalApiCostUsd: number;
    totalNetSavingUsd: number;
    runs: AgentRun[];
    createdAt: string;
    updatedAt: string;
}

interface AgentRun {
    id: string;
    status: string;
    triggeredBy: string;
    dryRun: boolean;
    stepResults: any[] | null;
    logs: string[] | null;
    startedAt: string | null;
    finishedAt: string | null;
    error: string | null;
    createdAt: string;
    durationMs: number | null;
}

function statusColor(status: string): string {
    switch (status) {
        case 'idle': return '#22c55e';
        case 'running': return '#3b82f6';
        case 'error': return '#ef4444';
        case 'awaiting_approval': return '#f59e0b';
        default: return '#9ca3af';
    }
}

function runStatusBadge(status: string) {
    const colors: Record<string, string> = {
        SUCCEEDED: '#22c55e',
        FAILED: '#ef4444',
        RUNNING: '#3b82f6',
        QUEUED: '#6366f1',
        CANCELLED: '#9ca3af',
        WAITING_HITL: '#f59e0b'
    };
    return (
        <span style={{
            padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
            background: `${colors[status] ?? '#9ca3af'}18`, color: colors[status] ?? '#9ca3af'
        }}>
            {status}
        </span>
    );
}

export default function AgentDetailPage() {
    const params = useParams();
    const agentId = params.id as string;
    const [agent, setAgent] = useState<AgentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [expandedRun, setExpandedRun] = useState<string | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [personaEditing, setPersonaEditing] = useState(false);
    const [personaValue, setPersonaValue] = useState('');
    const [memories, setMemories] = useState<any>(null);

    const fetchAgentAndMemories = useCallback(async () => {
        try {
            const [agentRes, memoriesRes] = await Promise.all([
                fetch(`/api/proxy?path=${encodeURIComponent(`/agents/${agentId}`)}`),
                fetch(`/api/proxy?path=${encodeURIComponent(`/agents/${agentId}/memories`)}`)
            ]);

            if (agentRes.ok) {
                const agentData = await agentRes.json();
                setAgent(agentData);
                setPersonaValue(agentData.persona || '');
            }
            if (memoriesRes.ok) {
                const memoriesData = await memoriesRes.json();
                setMemories(memoriesData);
            }
        } catch {
            // silent
        } finally {
            setLoading(false);
        }
    }, [agentId]);

    useEffect(() => { fetchAgentAndMemories(); }, [fetchAgentAndMemories]);

    const handleAction = async (action: 'pause' | 'resume' | 'retrain') => {
        setActionLoading(action);
        try {
            await fetch(`/api/proxy?path=${encodeURIComponent(`/agents/${agentId}/${action}`)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            await fetchAgentAndMemories();
        } catch { } finally {
            setActionLoading(null);
        }
    };

    const handleSavePersona = async () => {
        setActionLoading('persona');
        try {
            await fetch(`/api/proxy?path=${encodeURIComponent(`/agents/${agentId}/persona`)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ persona: personaValue })
            });
            await fetchAgentAndMemories();
            setPersonaEditing(false);
        } catch { } finally {
            setActionLoading(null);
        }
    };

    const handleApproveStep = async (runId: string, stepIndex: number) => {
        setActionLoading('approve');
        try {
            await fetch(`/api/proxy?path=${encodeURIComponent(`/automation/runs/${runId}/approve-step/${stepIndex}`)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            await fetchAgentAndMemories();
        } catch { } finally {
            setActionLoading(null);
        }
    };

    if (loading) {
        return (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted-foreground)' }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                Loading agent...
            </div>
        );
    }

    if (!agent) {
        return (
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p>Agent not found.</p>
                <Link href="/agents" style={{ color: 'var(--primary)' }}>← Back to Agents</Link>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px 32px', maxWidth: '1100px' }}>
            {/* Header */}
            <div style={{ marginBottom: '8px' }}>
                <Link href="/agents" style={{ fontSize: '13px', color: 'var(--muted-foreground)', textDecoration: 'none' }}>
                    ← All Agents
                </Link>
            </div>
            <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                {/* Agent Identity Card */}
                <div style={{ flex: 1, padding: '24px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', gap: '24px' }}>
                    {/* Avatar */}
                    <div style={{
                        width: 90, height: 90, borderRadius: '24px', background: 'var(--primary)', color: 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', fontWeight: 600, flexShrink: 0,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                    }}>
                        {agent.avatarUrl ? <img src={agent.avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', borderRadius: '24px', objectFit: 'cover' }} /> : agent.name.charAt(0)}
                    </div>

                    {/* Details */}
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '0 0 6px' }}>{agent.name}</h1>
                                <div style={{ fontSize: '14px', color: 'var(--muted-foreground)', display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    {agent.jobTitle && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>💼 {agent.jobTitle}</span>}
                                    {agent.department && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>🏢 {agent.department}</span>}
                                    {agent.manager && <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>👤 Reports to: {agent.manager}</span>}
                                </div>
                            </div>

                            {/* Actions & Status */}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span style={{
                                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                                    padding: '4px 12px', borderRadius: '16px', fontSize: '12px', fontWeight: 600, marginRight: '8px',
                                    background: `${statusColor(agent.currentStatus)}18`, color: statusColor(agent.currentStatus)
                                }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(agent.currentStatus) }} />
                                    {agent.currentStatus.toUpperCase()}
                                </span>
                                {agent.status === 'ACTIVE' ? (
                                    <button onClick={() => handleAction('pause')} disabled={actionLoading === 'pause'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: '1px solid var(--border)', background: 'var(--bg)', cursor: 'pointer', color: 'var(--foreground)' }}>
                                        {actionLoading === 'pause' ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />} Pause
                                    </button>
                                ) : (
                                    <button onClick={() => handleAction('resume')} disabled={actionLoading === 'resume'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: '1px solid #22c55e', background: 'rgba(34,197,94,0.08)', cursor: 'pointer', color: '#22c55e' }}>
                                        {actionLoading === 'resume' ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />} Resume
                                    </button>
                                )}
                                <button onClick={() => handleAction('retrain')} disabled={actionLoading === 'retrain'} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', background: 'var(--primary)', cursor: 'pointer', color: 'white' }}>
                                    {actionLoading === 'retrain' ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Retrain
                                </button>
                            </div>
                        </div>

                        {agent.description && <p style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: 1.5, color: 'var(--foreground)' }}>{agent.description}</p>}

                        {/* Persona Editor */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--muted-foreground)' }}>System Persona & Instructions</span>
                                {!personaEditing && (
                                    <button onClick={() => setPersonaEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', padding: 0 }}>Edit</button>
                                )}
                            </div>
                            {personaEditing ? (
                                <div>
                                    <textarea
                                        value={personaValue}
                                        onChange={(e) => setPersonaValue(e.target.value)}
                                        placeholder="Define the agent's persona. e.g. 'You are James, the support triage agent. Always be extremely polite and escalate any billing issues directly to engineering immediately.'"
                                        style={{ width: '100%', minHeight: '100px', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--foreground)', fontSize: '13px', fontFamily: 'monospace', marginBottom: '8px', resize: 'vertical' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                        <button onClick={() => { setPersonaEditing(false); setPersonaValue(agent.persona || ''); }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', cursor: 'pointer', color: 'var(--foreground)', fontSize: '12px' }}>Cancel</button>
                                        <button onClick={handleSavePersona} disabled={actionLoading === 'persona'} style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>{actionLoading === 'persona' ? 'Saving...' : 'Save Persona'}</button>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '16px', borderRadius: '8px', background: 'var(--bg)', border: '1px solid var(--border)', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: agent.persona ? 'var(--foreground)' : 'var(--muted-foreground)', maxHeight: '150px', overflowY: 'auto' }}>
                                    {agent.persona || 'No specific persona or behavioral instructions configured. The agent will use default execution rules.'}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '28px' }}>
                <div className="stat-card">
                    <span className="stat-label">Total Runs</span>
                    <span className="stat-value">{agent.totalRuns}</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Success Rate</span>
                    <span className="stat-value">{agent.successRate}%</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">Time Saved</span>
                    <span className="stat-value">{agent.totalTimeSavedHours}h</span>
                    <span className="stat-sub">{agent.totalTimeSavedMinutes.toFixed(0)} minutes total</span>
                </div>
                <div className="stat-card">
                    <span className="stat-label">API Cost</span>
                    <span className="stat-value">${agent.totalApiCostUsd.toFixed(3)}</span>
                    <span className="stat-sub">total token spend</span>
                </div>
                <div className="stat-card" style={{ borderLeft: `3px solid ${agent.totalNetSavingUsd > 0 ? '#22c55e' : '#ef4444'}` }}>
                    <span className="stat-label">Net Saving</span>
                    <span className="stat-value">${agent.totalNetSavingUsd.toFixed(2)}</span>
                    <span className="stat-sub">human cost − API cost</span>
                </div>
            </div>

            {/* Semantic Memory Base */}
            {memories && memories.semantic && memories.semantic.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🧠 Semantic Memory (Learned Facts)
                    </h2>
                    <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--foreground)' }}>
                            {memories.semantic.map((m: any) => (
                                <li key={m.id} style={{ marginBottom: '8px' }}>{m.content}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}

            {/* AI Reasoning */}
            {agent.aiReasoning && (
                <div style={{
                    padding: '16px', marginBottom: '24px', borderRadius: '8px',
                    background: 'var(--bg-elevated)', border: '1px solid var(--border)'
                }}>
                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                        AI Reasoning
                    </div>
                    <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{agent.aiReasoning}</div>
                </div>
            )}

            {/* HITL Approval Banner */}
            {agent.currentStatus === 'awaiting_approval' && agent.runs[0]?.status === 'WAITING_HITL' && (
                <div style={{
                    padding: '16px 20px', marginBottom: '24px', borderRadius: '8px',
                    background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px', color: '#f59e0b' }}>
                                ⏸ Human-in-the-Loop Approval Required
                            </div>
                            <div style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
                                This is the first run of this agent. A write-back step requires your approval before execution.
                            </div>
                            {agent.runs[0]?.logs && (
                                <div style={{ fontSize: '12px', marginTop: '8px', fontFamily: 'monospace', color: 'var(--foreground)' }}>
                                    {(agent.runs[0].logs as string[]).filter(l => l.includes('What will happen')).map((l, i) => (
                                        <div key={i}>{l.split('] ')[1]}</div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                const results = agent.runs[0]?.stepResults ?? [];
                                handleApproveStep(agent.runs[0].id, results.length);
                            }}
                            disabled={actionLoading === 'approve'}
                            style={{
                                padding: '10px 24px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
                                border: 'none', background: '#22c55e', color: 'white', cursor: 'pointer',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {actionLoading === 'approve' ? 'Approving...' : '✓ Approve & Execute'}
                        </button>
                    </div>
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                {/* Run History */}
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px' }}>Run History</h2>
                    {agent.runs.length === 0 ? (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted-foreground)', fontSize: '14px' }}>
                            No runs yet. Click &quot;Retrain&quot; to execute the first run.
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Status</th>
                                        <th>Triggered By</th>
                                        <th>Duration</th>
                                        <th>Steps</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {agent.runs.map(run => (
                                        <>
                                            <tr key={run.id} style={{ cursor: 'pointer' }} onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}>
                                                <td style={{ width: 28 }}>
                                                    {expandedRun === run.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                </td>
                                                <td>{runStatusBadge(run.status)}</td>
                                                <td style={{ fontSize: '12px' }}>
                                                    {run.triggeredBy.startsWith('event:') ? '⚡ ' + run.triggeredBy.slice(6, 30) : run.triggeredBy}
                                                    {run.dryRun && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#f59e0b' }}>(dry-run)</span>}
                                                </td>
                                                <td style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                                                    {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                                                </td>
                                                <td style={{ fontSize: '12px' }}>
                                                    {run.stepResults ? (run.stepResults as any[]).length : 0}
                                                </td>
                                                <td style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                                    {new Date(run.createdAt).toLocaleString()}
                                                </td>
                                            </tr>

                                            {expandedRun === run.id && (
                                                <tr key={`${run.id}-detail`}>
                                                    <td colSpan={6}>
                                                        <div style={{ padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: '8px', margin: '4px 0 8px' }}>
                                                            {/* Step Results */}
                                                            {run.stepResults && (run.stepResults as any[]).length > 0 && (
                                                                <div style={{ marginBottom: '12px' }}>
                                                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                                                                        Step Results
                                                                    </div>
                                                                    {(run.stepResults as any[]).map((step: any, i: number) => (
                                                                        <div key={i} style={{
                                                                            display: 'flex', gap: '12px', padding: '6px 0',
                                                                            borderBottom: '1px solid var(--border)', fontSize: '13px'
                                                                        }}>
                                                                            <span style={{ fontWeight: 500, minWidth: '80px' }}>{step.stepId}</span>
                                                                            <span style={{ color: 'var(--muted-foreground)', minWidth: '120px' }}>{step.action}</span>
                                                                            <span>{runStatusBadge(step.status?.toUpperCase?.() ?? step.status)}</span>
                                                                            <span style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>{step.durationMs}ms</span>
                                                                            {step.error && <span style={{ color: '#ef4444', fontSize: '12px' }}>{step.error}</span>}
                                                                            {step.output?.agentDecision && (
                                                                                <span style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--muted-foreground)' }}>
                                                                                    Agent: {step.output.reasoning}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Logs */}
                                                            {run.logs && (run.logs as string[]).length > 0 && (
                                                                <div>
                                                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted-foreground)', marginBottom: '6px' }}>
                                                                        Run Log
                                                                    </div>
                                                                    <pre style={{
                                                                        fontSize: '11px', lineHeight: 1.6, padding: '10px',
                                                                        background: 'var(--bg)', borderRadius: '6px', overflow: 'auto',
                                                                        maxHeight: '300px', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                                                    }}>
                                                                        {(run.logs as string[]).join('\n')}
                                                                    </pre>
                                                                </div>
                                                            )}

                                                            {run.error && (
                                                                <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', background: 'rgba(239,68,68,0.08)', color: '#ef4444', fontSize: '12px' }}>
                                                                    Error: {run.error}
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
                    )}
                </div>

                {/* Recent Activity Feed */}
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px' }}>Recent Activity Feed</h2>
                    <div style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: '8px', border: '1px solid var(--border)', maxHeight: '600px', overflowY: 'auto' }}>
                        {memories && memories.episodic && memories.episodic.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {memories.episodic.map((m: any) => (
                                    <div key={m.id} style={{ fontSize: '12px', paddingBottom: '12px', borderBottom: '1px solid var(--border)' }}>
                                        <div style={{ color: 'var(--muted-foreground)', marginBottom: '4px', fontSize: '10px' }}>
                                            {new Date(m.createdAt).toLocaleString()}
                                        </div>
                                        <div style={{ color: 'var(--foreground)', lineHeight: 1.4 }}>{m.content}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ fontSize: '13px', color: 'var(--muted-foreground)', textAlign: 'center', padding: '24px 0' }}>
                                No recent agent activity found.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Blueprint Steps */}
            {agent.steps && (agent.steps as any[]).length > 0 && (
                <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 12px' }}>Blueprint Steps</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {(agent.steps as any[]).map((step: any, i: number) => (
                            <div key={i} style={{
                                padding: '12px 16px', borderRadius: '8px',
                                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                                display: 'flex', gap: '12px', alignItems: 'center'
                            }}>
                                <span style={{
                                    width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)',
                                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '12px', fontWeight: 700, flexShrink: 0
                                }}>
                                    {i + 1}
                                </span>
                                <div>
                                    <div style={{ fontWeight: 500, fontSize: '14px' }}>{step.name ?? step.action}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                        {step.connectorId}.{step.action}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
