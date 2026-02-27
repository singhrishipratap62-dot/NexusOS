'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Network, Plus, Play, ChevronRight, Activity, AlertCircle, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function ChainsClient() {
    const [chains, setChains] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchChains() {
            try {
                const res = await fetch('/api/proxy?path=' + encodeURIComponent('/chains'));
                if (res.ok) {
                    const data = await res.json();
                    setChains(data);
                }
            } catch (err) {
                console.error('Failed to load chains', err);
            } finally {
                setLoading(false);
            }
        }
        fetchChains();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
                <Activity className="w-5 h-5 animate-pulse mr-2" />
                Loading chains...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold">Deployed Chains</h2>
                    <p className="text-sm text-muted-foreground">Manage multi-agent workflows and handoffs.</p>
                </div>
                <Link
                    href="/chains/builder"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Create Chain
                </Link>
            </div>

            {chains.length === 0 ? (
                <div className="border border-dashed border-border rounded-xl p-12 text-center bg-muted/20">
                    <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                    <h3 className="text-lg font-semibold mb-2">No chains deployed</h3>
                    <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                        Agent chains allow you to connect multiple agents together, where one agent's output becomes the next agent's input.
                    </p>
                    <Link
                        href="/chains/builder"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary text-sm font-semibold rounded-lg hover:bg-primary/20 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Build your first chain
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {chains.map((chain) => (
                        <Link
                            key={chain.id}
                            href={`/chains/${chain.id}`}
                            className="block border border-border bg-card rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-sm transition-all group"
                        >
                            <div className="p-5 border-b border-border">
                                <div className="flex justify-between items-start mb-2">
                                    <h3 className="font-bold text-base group-hover:text-primary transition-colors">{chain.name}</h3>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${chain.status === 'ACTIVE' ? 'bg-green-500/10 text-green-600' :
                                            chain.status === 'PAUSED' ? 'bg-amber-500/10 text-amber-600' :
                                                'bg-slate-500/10 text-slate-600'
                                        }`}>
                                        {chain.status}
                                    </span>
                                </div>
                                {chain.description && (
                                    <p className="text-sm text-muted-foreground line-clamp-2">{chain.description}</p>
                                )}
                            </div>

                            <div className="bg-muted/30 p-4">
                                <div className="flex items-center gap-2 mb-4">
                                    {chain.nodeDetails.map((node: any, idx: number) => (
                                        <div key={idx} className="flex items-center">
                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-background border border-border rounded text-xs font-medium cursor-help" title={node.agentName}>
                                                <div className={`w-2 h-2 rounded-full ${node.agentStatus === 'ACTIVE' ? 'bg-green-500' : 'bg-slate-400'}`} />
                                                <span className="truncate max-w-[80px]">{node.agentName}</span>
                                            </div>
                                            {idx < chain.nodeDetails.length - 1 && (
                                                <ChevronRight className="w-3 h-3 text-muted-foreground mx-1 flex-shrink-0" />
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-between items-center text-xs text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <Play className="w-3 h-3" />
                                            {chain.totalRuns} runs
                                        </span>
                                        {chain.lastRun && (
                                            <span className="flex items-center gap-1" title={new Date(chain.lastRun.createdAt).toLocaleString()}>
                                                <Clock className="w-3 h-3" />
                                                {formatDistanceToNow(new Date(chain.lastRun.createdAt), { addSuffix: true })}
                                            </span>
                                        )}
                                    </div>
                                    {chain.lastRun?.status === 'FAILED' && (
                                        <span className="flex items-center gap-1 text-red-500 font-medium">
                                            <AlertCircle className="w-3 h-3" />
                                            Failed
                                        </span>
                                    )}
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
