'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Trash2, Save, Bot, ChevronDown, Check, GitMerge } from 'lucide-react';

export default function ChainBuilderClient() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [nodes, setNodes] = useState<{ blueprintId: string; triggerCondition: string }[]>([]);

    const [agents, setAgents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        async function fetchAgents() {
            try {
                const res = await fetch('/api/proxy?path=' + encodeURIComponent('/agents'));
                if (res.ok) {
                    const data = await res.json();
                    // Only allow active agents in chains
                    setAgents(data.filter((a: any) => a.status === 'ACTIVE'));
                }
            } catch (err) { }
            setLoading(false);
        }
        fetchAgents();
    }, []);

    const addNode = () => {
        setNodes([...nodes, { blueprintId: '', triggerCondition: 'on_success' }]);
    };

    const removeNode = (index: number) => {
        setNodes(nodes.filter((_, i) => i !== index));
    };

    const updateNode = (index: number, field: string, value: string) => {
        const newNodes = [...nodes];
        newNodes[index] = { ...newNodes[index], [field]: value };
        setNodes(newNodes);
    };

    const handleSave = async () => {
        if (!name || nodes.length < 2 || nodes.some(n => !n.blueprintId)) return;

        setSaving(true);
        try {
            const payload = {
                name,
                description,
                nodes: nodes.map((n, i) => ({ ...n, position: i }))
            };

            const res = await fetch('/api/proxy?path=' + encodeURIComponent('/chains'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                router.push(`/chains/${data.id}`);
            }
        } catch (err) {
            console.error(err);
            setSaving(false);
        }
    };

    if (loading) return <div className="p-12 text-center text-muted-foreground animate-pulse">Loading available agents...</div>;

    const isValid = name.trim().length > 0 && nodes.length >= 2 && nodes.every(n => n.blueprintId !== '');

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/chains" className="p-2 -ml-2 rounded-full hover:bg-muted text-muted-foreground transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-2xl font-bold tracking-tight">Create New Chain</h1>
                </div>
                <button
                    onClick={handleSave}
                    disabled={!isValid || saving}
                    className="inline-flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                >
                    {saving ? <span className="animate-spin text-lg leading-none">⚙</span> : <Save size={18} />}
                    {saving ? 'Saving...' : 'Save & Activate Chain'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="col-span-1 space-y-6">
                    <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
                        <h2 className="font-bold text-lg mb-2">Chain Details</h2>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Chain Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Triage & Ticket Creation"
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Description (Optional)</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="What does this chain accomplish end-to-end?"
                                rows={3}
                                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                            />
                        </div>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 rounded-xl p-5 text-sm">
                        <h3 className="font-bold text-primary flex items-center gap-2 mb-2">
                            <GitMerge size={16} /> How Chains Work
                        </h3>
                        <p className="text-muted-foreground mb-3 leading-relaxed">
                            When an agent in the chain completes its task successfully, its <strong>output payload</strong> is automatically passed to the next agent as <strong>input context</strong>.
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                            The downstream agent's reasoning engine will read this context and adjust its execution parameters accordingly.
                        </p>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-4">
                    <h2 className="font-bold text-lg">Agent Sequence</h2>

                    {nodes.length === 0 ? (
                        <div className="border-2 border-dashed border-border rounded-xl p-12 text-center text-muted-foreground bg-muted/20">
                            <Bot size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="mb-4">Start building your chain by adding the first agent.</p>
                            <button
                                onClick={addNode}
                                className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground font-semibold rounded-lg hover:bg-secondary/80 transition-colors"
                            >
                                <Plus size={16} /> Add First Agent
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {nodes.map((node, index) => (
                                <div key={index} className="relative">
                                    {/* Handoff Arrow */}
                                    {index > 0 && (
                                        <div className="flex flex-col items-center justify-center my-2 -ml-32">
                                            <div className="w-0.5 h-6 bg-border relative">
                                                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-2 h-2 border-b-2 border-r-2 border-border transform rotate-45" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex gap-4 items-start group relative">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                                            {index + 1}
                                        </div>

                                        <div className="flex-1 space-y-4">
                                            {index > 0 && (
                                                <div>
                                                    <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Trigger Condition</label>
                                                    <select
                                                        value={node.triggerCondition}
                                                        onChange={(e) => updateNode(index, 'triggerCondition', e.target.value)}
                                                        className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary w-full md:w-auto"
                                                    >
                                                        <option value="on_success">When previous agent succeeds</option>
                                                        <option value="always">Always run (even if previous failed)</option>
                                                        <option value="conditional">Conditional (AI determined)</option>
                                                    </select>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Select Agent</label>
                                                <div className="relative">
                                                    <select
                                                        value={node.blueprintId}
                                                        onChange={(e) => updateNode(index, 'blueprintId', e.target.value)}
                                                        className="w-full bg-background border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none font-medium"
                                                    >
                                                        <option value="" disabled>-- Select an active agent --</option>
                                                        {agents.map(a => (
                                                            <option key={a.id} value={a.id}>{a.name}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => removeNode(index)}
                                            className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Remove agent from chain"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}

                            <div className="pt-4 flex justify-center">
                                <button
                                    onClick={addNode}
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground text-sm font-semibold rounded-lg hover:bg-secondary/80 transition-colors border border-border border-dashed hover:border-solid w-full justify-center"
                                >
                                    <Plus size={16} /> Add Next Agent
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
