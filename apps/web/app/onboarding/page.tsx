'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowRight,
    Cable,
    Search,
    BarChart3,
    Zap,
    Loader2,
    PlayCircle,
    Bot
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const STEPS = [
    { id: 'welcome', title: 'Welcome to NexusOS', icon: Zap, content: 'welcome' },
    { id: 'connect', title: 'Connect a Tool', icon: Cable, content: 'connect' },
    { id: 'audit', title: 'Run Your First Audit', icon: Search, content: 'audit' },
    { id: 'opportunities', title: 'See Opportunities', icon: BarChart3, content: 'opportunities' },
    { id: 'deploy', title: 'Deploy AI Agent', icon: Bot, content: 'deploy' }
];

const CONNECTORS = [
    { provider: 'SLACK', name: 'Slack', icon: '💬' },
    { provider: 'GMAIL', name: 'Gmail', icon: '📧' },
    { provider: 'GCAL', name: 'Google Calendar', icon: '📅' },
    { provider: 'GITHUB', name: 'GitHub', icon: '🐙' }
];

export default function OnboardingPage() {
    const [currentStep, setCurrentStep] = useState(0);
    const [isSyncing, setIsSyncing] = useState(false);
    const [hasConnected, setHasConnected] = useState(false);
    const [hasAudited, setHasAudited] = useState(false);
    const [hasDeployed, setHasDeployed] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);

    // For Step 4 & 5
    const [topOpportunity, setTopOpportunity] = useState<any>(null);

    const router = useRouter();
    const step = STEPS[currentStep];

    useEffect(() => {
        // Simple polling to check if user connected a tool (OAuth return)
        const checkConnectors = async () => {
            if (currentStep !== 1 || hasConnected) return;
            try {
                const res = await fetch('/api/proxy?path=/connectors');
                const data = await res.json();
                if (data.length > 0) {
                    setHasConnected(true);
                    setCurrentStep(2);
                }
            } catch (e) { }
        };
        const interval = setInterval(checkConnectors, 3000);
        return () => clearInterval(interval);
    }, [currentStep, hasConnected]);

    const handleConnect = async (provider: string) => {
        try {
            const res = await fetch(`/api/proxy?path=/connectors/${provider.toLowerCase()}/oauth/start`);
            const data = await res.json();
            if (data.url) {
                // Open OAuth in a popup or new tab so onboarding flow strictly stays open
                window.open(data.url, '_blank');
                alert(`After connecting ${provider}, please return to this tab!`);
            } else {
                console.error('Missing URL in OAuth response:', data);
            }
        } catch (e) {
            console.error('Failed to start OAuth flow:', e);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            // We just hit slack sync as a stub
            await fetch('/api/proxy?path=/connectors/slack/sync', { method: 'POST' });
            // Wait a few seconds
            await new Promise((r) => setTimeout(r, 2000));

            // Try formatting something as an opportunity
            const res = await fetch('/api/proxy?path=/war-room/executive-summary');
            if (res.ok) {
                const data = await res.json();
                if (data.biggestOpportunity) {
                    setTopOpportunity(data.biggestOpportunity);
                }
            }
        } catch { }
        setIsSyncing(false);
        setHasAudited(true);
        setCurrentStep(3);
    };

    const handleDeploy = async () => {
        if (!topOpportunity) return;
        setIsDeploying(true);
        try {
            await fetch(`/api/proxy?path=/war-room/deploy-agent/${topOpportunity.workflowId}`, {
                method: 'POST'
            });
            // Auto Activate it as well
            await fetch(`/api/proxy?path=/automation/blueprints/${topOpportunity.workflowId}/activate`, {
                method: 'PUT'
            });
            setHasDeployed(true);
        } catch (e) { }
        setIsDeploying(false);
        setCurrentStep(4);
    };

    const finishOnboarding = () => {
        router.push('/war-room');
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-zinc-950 text-white">
            <div className="w-full max-w-xl">
                {/* Progress bar */}
                <div className="flex items-center gap-2 mb-8">
                    {STEPS.map((s, i) => (
                        <div key={s.id} className="h-2 flex-1 rounded-full overflow-hidden bg-zinc-800">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: i < currentStep ? '100%' : (i === currentStep ? '50%' : '0%') }}
                            />
                        </div>
                    ))}
                </div>

                <Card className="p-8 bg-zinc-900 border-zinc-800 shadow-xl text-white">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30">
                            <step.icon className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-blue-400 text-sm font-semibold mb-1">Step {currentStep + 1} of 5</p>
                            <h2 className="text-2xl font-bold">{step.title}</h2>
                        </div>
                    </div>

                    <div className="min-h-[250px]">
                        {step.content === 'welcome' && (
                            <div className="space-y-6">
                                <p className="text-zinc-400 text-lg">
                                    NexusOS discovers your expensive manual workflows and builds AI agents to automate them.
                                </p>
                                {/* Placeholder for 30-sec demo video */}
                                <div className="w-full aspect-video bg-black rounded-lg border border-zinc-800 flex items-center justify-center relative group cursor-pointer hover:border-zinc-700 transition">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/10 to-transparent pointer-events-none" />
                                    <div className="text-center group-hover:scale-105 duration-200">
                                        <PlayCircle className="w-16 h-16 text-zinc-600 mb-2 mx-auto" />
                                        <p className="text-sm text-zinc-500 font-medium">Watch 30s Demo</p>
                                    </div>
                                </div>
                                <Button className="w-full bg-white text-black hover:bg-zinc-200 h-12 text-md" onClick={() => setCurrentStep(1)}>
                                    Get Started
                                    <ArrowRight className="w-5 h-5 ml-2" />
                                </Button>
                            </div>
                        )}

                        {step.content === 'connect' && (
                            <div className="space-y-4">
                                <p className="text-zinc-400">
                                    NexusOS needs read-only access to where your work happens. Pick one to start.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {CONNECTORS.map((c) => (
                                        <button
                                            key={c.provider}
                                            onClick={() => handleConnect(c.provider)}
                                            className="p-4 rounded-xl border border-zinc-800 hover:border-blue-500 bg-zinc-950/50 flex flex-col items-center justify-center gap-3 transition"
                                        >
                                            <span className="text-3xl">{c.icon}</span>
                                            <span className="font-medium text-sm">{c.name}</span>
                                        </button>
                                    ))}
                                </div>
                                {hasConnected && (
                                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center justify-center font-medium gap-2">
                                        <Zap className="w-4 h-4" /> Tool connected successfully!
                                    </div>
                                )}
                            </div>
                        )}

                        {step.content === 'audit' && (
                            <div className="space-y-6 text-center pt-8">
                                <p className="text-zinc-400 mb-4">
                                    We'll securely analyze recent activity to find repetitive manual tasks.
                                </p>
                                <Button
                                    className="bg-blue-600 hover:bg-blue-500 text-white h-14 px-8 text-lg rounded-full"
                                    onClick={handleSync}
                                    disabled={isSyncing || hasAudited}
                                >
                                    {isSyncing ? (
                                        <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Analyzing 10,000+ events...</>
                                    ) : (
                                        <><Search className="w-5 h-5 mr-3" /> Run Audit Now</>
                                    )}
                                </Button>
                            </div>
                        )}

                        {step.content === 'opportunities' && (
                            <div className="space-y-6">
                                <p className="text-zinc-300">
                                    Audit complete! Here is the biggest automation opportunity we found:
                                </p>
                                {topOpportunity ? (
                                    <div className="p-5 rounded-xl border border-blue-500/30 bg-blue-900/10">
                                        <h3 className="font-bold text-lg mb-2">{topOpportunity.workflowName}</h3>
                                        <div className="flex gap-4 mb-4 text-sm text-zinc-400">
                                            <span><strong>${topOpportunity.potentialSavings?.toLocaleString()}</strong> Labor Cost</span>
                                            <span>•</span>
                                            <span><strong>{topOpportunity.monthlyRuns}</strong> times/mo</span>
                                        </div>
                                        <Button className="w-full h-12 bg-white text-black hover:bg-zinc-200" onClick={() => setCurrentStep(4)}>
                                            Automate This Workflow
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="p-5 rounded-xl border border-zinc-800 bg-zinc-950 text-center">
                                        <p className="text-zinc-500 mb-4">No overwhelming opportunity found yet. Let's head to the War Room to dig deeper.</p>
                                        <Button className="w-full bg-white text-black" onClick={finishOnboarding}>Go to War Room</Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {step.content === 'deploy' && topOpportunity && (
                            <div className="space-y-6 text-center pt-8">
                                <p className="text-zinc-400 mb-4">
                                    We will spin up an autonomous agent tailored to "{topOpportunity.workflowName}".
                                </p>
                                {!hasDeployed ? (
                                    <Button
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white h-14 px-8 text-lg rounded-full"
                                        onClick={handleDeploy}
                                        disabled={isDeploying}
                                    >
                                        {isDeploying ? (
                                            <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Provisioning Agent...</>
                                        ) : (
                                            <><Bot className="w-5 h-5 mr-3" /> Deploy First Agent</>
                                        )}
                                    </Button>
                                ) : (
                                    <div className="space-y-6">
                                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg flex items-center justify-center font-bold text-lg">
                                            Your Agent is LIVE!
                                        </div>
                                        <Button className="w-full h-12 bg-white text-black font-semibold" onClick={finishOnboarding}>
                                            Enter the War Room
                                            <ArrowRight className="w-5 h-5 ml-2" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    );
}
