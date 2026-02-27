'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Play, RefreshCw, AlertCircle, Clock, CheckCircle2, XCircle, Terminal, FileJson, Bot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ChainDetailClient({ chainId }: { chainId: string }) {
    const [chain, setChain] = useState<any>(null);
    const [runs, setRuns] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [selectedRun, setSelectedRun] = useState<any>(null);
    const [retryingId, setRetryingId] = useState<string | null>(null);

    const fetchDetail = useCallback(async () => {
        try {
            const [chainRes, runsRes] = await Promise.all([
                fetch('/api/proxy?path=' + encodeURIComponent(`/chains/${chainId}`)),
                fetch('/api/proxy?path=' + encodeURIComponent(`/chains/${chainId}/runs`))
            ]);
            if (chainRes.ok) setChain(await chainRes.json());
            if (runsRes.ok) setRuns(await runsRes.json());
        } catch (err) { }
        setLoading(false);
    }, [chainId]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleRun = async () => {
        setRunning(true);
        try {
            // Trigger via API (no input body for manual root run)
            await fetch('/api/proxy?path=' + encodeURIComponent(`/chains/${chainId}/run`), {
                method: 'POST'
            });
            fetchDetail();
        } catch (err) { }
        setRunning(false);
    };

    const handleRetry = async (runId: string) => {
        setRetryingId(runId);
        try {
            await fetch('/api/proxy?path=' + encodeURIComponent(`/chains/${chainId}/retry/${runId}`), {
                method: 'POST'
            });
            fetchDetail();
            setSelectedRun(null);
        } catch { }
        setRetryingId(null);
    };

    if (loading || !chain) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                Loading chain details...
            </div>
        );
    }

    const nodes = chain.nodeDetails || [];
    const metrics = chain.metrics || {};

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-border pb-6">
                <Link href="/chains" className="text-muted-foreground hover:text-foreground transition-colors p-2 -ml-2 rounded-full hover:bg-muted">
                    <ArrowLeft size={20} />
                </Link>
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl font-bold tracking-tight">{chain.name}</h1>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${chain.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' : 'bg-slate-500/10 text-slate-600'
                            }`}>
                            {chain.status}
                        </span>
                    </div>
                    {chain.description && <p className="text-muted-foreground mt-1">{chain.description}</p>}
                </div>
                <button
                    onClick={handleRun}
                    disabled={running || chain.status !== 'ACTIVE'}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    {running ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    {running ? 'Starting...' : 'Run Chain Manually'}
                </button>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Total Runs</h3>
                    <p className="text-2xl font-bold">{metrics.totalRuns ?? 0}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Success Rate</h3>
                    <p className="text-2xl font-bold">{metrics.successRate ?? 0}%</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Avg Duration</h3>
                    <p className="text-2xl font-bold">{metrics.avgDurationSeconds ? `${metrics.avgDurationSeconds}s` : '—'}</p>
                </div>
                <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Chain Length</h3>
                    <p className="text-2xl font-bold">{metrics.nodeCount ?? 0} agents</p>
                </div>
            </div>

            {/* Visual Flow */}
            <div>
                <h2 className="text-lg font-bold mb-4">Chain Flow</h2>
                <div className="bg-muted/30 border border-border rounded-xl p-8 overflow-x-auto relative">
                    <div className="flex items-center min-w-max gap-4">
                        {nodes.map((node: any, idx: number) => (
                            <div key={idx} className="flex items-center">
                                {/* Node Card */}
                                <div className="w-64 bg-card border border-border rounded-xl p-4 shadow-sm relative group">
                                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold shadow-sm">
                                        {idx + 1}
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${node.agentStatus === 'ACTIVE' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                            <Bot size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm line-clamp-1" title={node.agentName}>{node.agentName}</h4>
                                            <p className="text-xs text-muted-foreground mt-0.5 capitalize">{node.persona ?? 'Default Persona'}</p>
                                        </div>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-border/50 text-xs">
                                        <span className="text-muted-foreground font-medium">Trigger: </span>
                                        <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{node.triggerCondition}</span>
                                    </div>
                                </div>

                                {/* Arrow */}
                                {idx < nodes.length - 1 && (
                                    <div className="flex flex-col items-center mx-2 relative top-2">
                                        <div className="h-0.5 w-12 bg-border relative">
                                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-border transform rotate-45" />
                                        </div>
                                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-1 bg-muted/50 px-2 py-0.5 rounded-full">
                                            Handoff
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Run History */}
            <div>
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-lg font-bold">Execution History</h2>
                    <button onClick={fetchDetail} className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>

                {runs.length === 0 ? (
                    <div className="text-center p-8 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                        No runs yet. Click "Run Chain Manually" to test it out.
                    </div>
                ) : (
                    <div className="border border-border rounded-xl overflow-hidden bg-card">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-semibold text-muted-foreground w-40">Date</th>
                                    <th className="px-4 py-3 font-semibold text-muted-foreground w-28">Status</th>
                                    <th className="px-4 py-3 font-semibold text-muted-foreground w-24">Duration</th>
                                    <th className="px-4 py-3 font-semibold text-muted-foreground hidden md:table-cell">Progress</th>
                                    <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {runs.map((r) => {
                                    const duration = r.startedAt && r.finishedAt
                                        ? Math.round((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000)
                                        : null;

                                    const nodeResults = (r.nodeResults as any[]) ?? [];
                                    const sCount = nodeResults.filter(n => n.status === 'succeeded').length;
                                    const fCount = nodeResults.filter(n => n.status === 'failed').length;

                                    return (
                                        <tr key={r.id} className="hover:bg-muted/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="font-medium">{formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</div>
                                                <div className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${r.status === 'SUCCEEDED' ? 'bg-green-500/10 text-green-600' :
                                                        r.status === 'FAILED' ? 'bg-red-500/10 text-red-600' :
                                                            'bg-blue-500/10 text-blue-600'
                                                    }`}>
                                                    {r.status === 'SUCCEEDED' && <CheckCircle2 size={12} />}
                                                    {r.status === 'FAILED' && <XCircle size={12} />}
                                                    {(r.status === 'RUNNING' || r.status === 'QUEUED') && <RefreshCw size={12} className="animate-spin" />}
                                                    {r.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs">
                                                {duration !== null ? `${duration}s` : '—'}
                                            </td>
                                            <td className="px-4 py-3 hidden md:table-cell">
                                                <div className="flex items-center gap-1">
                                                    {nodeResults.map((nr, i) => (
                                                        <div
                                                            key={i}
                                                            className={`w-8 h-2 rounded-full ${nr.status === 'succeeded' ? 'bg-green-500' :
                                                                    nr.status === 'failed' ? 'bg-red-500' :
                                                                        nr.status === 'running' ? 'bg-blue-500 animate-pulse' :
                                                                            'bg-slate-200 dark:bg-slate-800'
                                                                }`}
                                                            title={`Node ${i + 1}: ${nr.status}`}
                                                        />
                                                    ))}
                                                </div>
                                                {r.consecutiveFailures >= 3 && (
                                                    <div className="text-[10px] text-red-500 font-bold uppercase mt-1 flex items-center gap-1">
                                                        <AlertCircle size={10} /> {r.consecutiveFailures} consecutive failures!
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <button
                                                    onClick={() => setSelectedRun(selectedRun?.id === r.id ? null : r)}
                                                    className="text-xs font-semibold text-primary hover:underline px-2 py-1"
                                                >
                                                    View Logs
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Selected Run Drawer */}
            {selectedRun && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
                    <div className="w-[600px] max-w-[90vw] bg-background h-full shadow-2xl flex flex-col border-l border-border animate-in slide-in-from-right">
                        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-muted/30">
                            <div>
                                <h3 className="font-bold text-lg">Chain Execution Info</h3>
                                <p className="text-xs text-muted-foreground font-mono">{selectedRun.id}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedRun.status === 'FAILED' && (
                                    <button
                                        onClick={() => handleRetry(selectedRun.id)}
                                        disabled={retryingId === selectedRun.id}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-md hover:bg-primary/90 disabled:opacity-50"
                                    >
                                        {retryingId === selectedRun.id ? <RefreshCw size={12} className="animate-spin" /> : <Play size={12} />}
                                        Retry from failure
                                    </button>
                                )}
                                <button onClick={() => setSelectedRun(null)} className="p-2 hover:bg-muted rounded-full">
                                    <XCircle size={20} className="text-muted-foreground" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 space-y-6">
                            {selectedRun.error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm flex gap-3">
                                    <AlertCircle className="shrink-0 mt-0.5" size={16} />
                                    <div>
                                        <div className="font-bold mb-1">Execution Failed</div>
                                        <div className="font-mono text-xs break-all">{selectedRun.error}</div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <h4 className="font-semibold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                                    <Terminal size={14} /> Agent Handoff Trace
                                </h4>

                                <div className="space-y-3 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border before:to-transparent">
                                    {(selectedRun.nodeResults as any[]).map((res, i) => (
                                        <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm
                        bg-slate-200 dark:bg-slate-800 text-muted-foreground">
                                                {res.status === 'succeeded' ? <CheckCircle2 size={16} className="text-green-500" /> :
                                                    res.status === 'failed' ? <XCircle size={16} className="text-red-500" /> :
                                                        res.status === 'running' ? <RefreshCw size={16} className="text-blue-500 animate-spin" /> :
                                                            <Clock size={16} />}
                                            </div>

                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-border bg-card shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-sm">Agent {i + 1}</span>
                                                    <span className={`text-[10px] font-bold uppercase ${res.status === 'succeeded' ? 'text-green-500' :
                                                            res.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'
                                                        }`}>{res.status}</span>
                                                </div>

                                                <div className="text-xs text-muted-foreground mb-3 font-mono">{nodes[i]?.agentName}</div>

                                                {res.error && (
                                                    <div className="text-xs text-red-500 mt-2 bg-red-500/10 p-2 rounded border border-red-500/20 font-mono break-all line-clamp-3">
                                                        {res.error}
                                                    </div>
                                                )}

                                                {res.output && (
                                                    <div className="mt-3 relative">
                                                        <div className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 mb-1">
                                                            <FileJson size={10} /> Output Payload
                                                        </div>
                                                        <pre className="text-[10px] font-mono bg-muted/50 p-2 rounded-md overflow-hidden max-h-32 relative">
                                                            {JSON.stringify(res.output, null, 2)}
                                                            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
                                                        </pre>
                                                        {i < nodes.length - 1 && res.status === 'succeeded' && (
                                                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-bold text-primary flex flex-col items-center">
                                                                ↓ Passed to next
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
