'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../components/ui/top-bar';
import { clientApiFetch as apiFetch } from '../../lib/api-client';
import Link from 'next/link';

interface AgentSummary {
    id: string;
    name: string;
    description: string | null;
    status: string;
    currentStatus: string;
    triggerType: string;
    dryRun: boolean;
    totalRuns: number;
    successRate: number;
    totalTimeSavedMinutes: number;
    totalTimeSavedHours: number;
    totalApiCostUsd: number;
    lastRunAt: string | null;
    lastRunStatus: string | null;
}

async function fetchAgents(): Promise<AgentSummary[]> {
    try {
        return await apiFetch<AgentSummary[]>('/agents');
    } catch {
        return [];
    }
}

function statusBadge(status: string) {
    const colors: Record<string, { bg: string; text: string }> = {
        idle: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
        running: { bg: 'rgba(59,130,246,0.12)', text: '#3b82f6' },
        error: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
        paused: { bg: 'rgba(156,163,175,0.12)', text: '#9ca3af' },
        awaiting_approval: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' }
    };
    const c = colors[status] ?? colors.paused;
    return (
        <span style={{
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600,
            background: c.bg,
            color: c.text,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
        }}>
            {status === 'awaiting_approval' ? '⏸ Approval' : status === 'running' ? '⚡ Running' : status === 'error' ? '✕ Error' : status === 'idle' ? '● Idle' : '⏸ Paused'}
        </span>
    );
}

export default async function AgentsPage(): Promise<JSX.Element> {
    const agents = await fetchAgents();

    return (
        <>
            <TopBar
                title="Agents"
                subtitle="Autonomous workflow agents — deployed and monitoring"
            />
            <div className="page-content">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="stat-card">
                        <span className="stat-label">Deployed</span>
                        <span className="stat-value">{agents.filter(a => a.status === 'ACTIVE').length}</span>
                        <span className="stat-sub">active agents</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Total Runs</span>
                        <span className="stat-value">{agents.reduce((s, a) => s + a.totalRuns, 0)}</span>
                        <span className="stat-sub">all time</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">Time Saved</span>
                        <span className="stat-value">{agents.reduce((s, a) => s + a.totalTimeSavedHours, 0).toFixed(1)}h</span>
                        <span className="stat-sub">total hours</span>
                    </div>
                    <div className="stat-card">
                        <span className="stat-label">API Cost</span>
                        <span className="stat-value">${agents.reduce((s, a) => s + a.totalApiCostUsd, 0).toFixed(3)}</span>
                        <span className="stat-sub">total spend</span>
                    </div>
                </div>

                {agents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted-foreground)' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                        <h3 style={{ fontSize: '18px', marginBottom: '8px' }}>No agents deployed yet</h3>
                        <p style={{ fontSize: '14px' }}>Generate an agent blueprint from the War Room to deploy your first agent.</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Agent</th>
                                    <th>Status</th>
                                    <th>Trigger</th>
                                    <th>Runs</th>
                                    <th>Success</th>
                                    <th>Time Saved</th>
                                    <th>API Cost</th>
                                    <th>Last Run</th>
                                </tr>
                            </thead>
                            <tbody>
                                {agents.map(agent => (
                                    <tr key={agent.id}>
                                        <td>
                                            <Link href={`/agents/${agent.id}`} style={{ color: 'var(--foreground)', textDecoration: 'none', fontWeight: 500 }}>
                                                {agent.name}
                                            </Link>
                                            {agent.description && (
                                                <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginTop: '2px' }}>
                                                    {agent.description.slice(0, 60)}{agent.description.length > 60 ? '…' : ''}
                                                </div>
                                            )}
                                        </td>
                                        <td>{statusBadge(agent.currentStatus)}</td>
                                        <td>
                                            <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-elevated)' }}>
                                                {agent.triggerType === 'EVENT' ? '⚡ Event' : agent.triggerType === 'SCHEDULED' ? '🕐 Schedule' : '👆 Manual'}
                                            </span>
                                        </td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{agent.totalRuns}</td>
                                        <td>{agent.successRate}%</td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>{agent.totalTimeSavedMinutes.toFixed(0)}min</td>
                                        <td style={{ fontVariantNumeric: 'tabular-nums' }}>${agent.totalApiCostUsd.toFixed(3)}</td>
                                        <td style={{ fontSize: '12px', color: 'var(--muted-foreground)' }}>
                                            {agent.lastRunAt ? new Date(agent.lastRunAt).toLocaleDateString() : '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
