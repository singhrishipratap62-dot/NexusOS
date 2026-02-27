'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Play, Loader2, Workflow, Bot, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function LandingClient() {
    const router = useRouter();
    const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);

    const handleSeeDemo = () => {
        setIsGeneratingDemo(true);
        // Simple demo simulation using timeout instead of the broken `/demo/seed` backend endpoint.
        setTimeout(() => {
            setIsGeneratingDemo(false);
            router.push('/login'); // Redirect to login as the 'demo' is just an interactive preview of the tool
        }, 1500);
    };

    return (
        <div className="flex flex-col min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
            {/* Nav */}
            <header className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                        <span className="font-bold text-lg text-white">N</span>
                    </div>
                    <span className="font-bold text-xl tracking-tight text-white">NexusOS</span>
                    <Badge variant="outline" className="ml-2 bg-blue-500/10 text-blue-400 border-blue-500/20">Beta</Badge>
                </div>
                <div className="flex gap-4">
                    <Button variant="ghost" onClick={() => router.push('/login')} className="text-zinc-400 hover:text-white hover:bg-white/5">
                        Log in
                    </Button>
                    <Button onClick={() => router.push('/register')} className="bg-white text-black hover:bg-zinc-200 duration-200">
                        Start Free
                    </Button>
                </div>
            </header>

            {/* Hero */}
            <main className="flex-1">
                <section className="relative pt-32 pb-24 overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-black to-black pointer-events-none" />
                    <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                            </span>
                            NexusOS 1.0 is now live
                        </div>

                        <h1 className="text-6xl md:text-7xl font-extrabold tracking-tight mb-8">
                            Your business runs on <br className="hidden md:block" />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-zinc-600">human labor. </span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">NexusOS changes that.</span>
                        </h1>

                        <p className="text-xl md:text-2xl text-zinc-400 max-w-3xl mx-auto mb-12 leading-relaxed">
                            Audit your SaaS workflows. Calculate the true cost of manual tasks.
                            Deploy autonomous AI agents to automate them instantly. Track real savings.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button size="lg" className="h-14 px-8 text-lg bg-blue-600 hover:bg-blue-500 text-white rounded-full group transition-all" onClick={() => router.push('/register')}>
                                Start Free Audit
                                <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 duration-200" />
                            </Button>

                            <Button size="lg" variant="outline" className="h-14 px-8 text-lg rounded-full border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-white transition-all overflow-hidden relative" onClick={handleSeeDemo} disabled={isGeneratingDemo}>
                                {isGeneratingDemo ? (
                                    <>
                                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                        Generating Demo Tenant...
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-5 h-5 mr-2 fill-current" />
                                        See Demo
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </section>

                {/* Social Proof */}
                <section className="py-12 border-y border-white/5 bg-white/[0.02]">
                    <div className="max-w-6xl mx-auto px-6 text-center">
                        <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest mb-6">Built for scale</p>
                        <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 duration-500 transition-all">
                            {/* Placeholder company logos / names */}
                            <span className="text-xl font-bold font-serif italic text-zinc-300">Acme Corp</span>
                            <span className="text-xl font-bold tracking-tighter text-zinc-300">GLOBEX</span>
                            <span className="text-xl font-bold font-mono text-zinc-300">INITRODE</span>
                            <span className="text-xl font-bold uppercase tracking-widest text-zinc-300">Soylent</span>
                            <span className="text-xl font-bold lowercase tracking-tight text-zinc-300">massive dynamic</span>
                        </div>
                    </div>
                </section>

                {/* Features */}
                <section className="py-24 max-w-6xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8">
                        <Card className="bg-zinc-900 border-zinc-800 p-8 hover:border-zinc-700 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center mb-6">
                                <ShieldAlert className="w-6 h-6 text-red-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Deep Audit</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                We connect to your Slack, Jira, Gmail, and GitHub. Our models map your communication patterns to find exactly where your team is bleeding time and money on manual tasks.
                            </p>
                        </Card>

                        <Card className="bg-zinc-900 border-zinc-800 p-8 hover:border-zinc-700 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6">
                                <Bot className="w-6 h-6 text-blue-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">Agent Factory</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Found a high-cost workflow? Deploy an AI agent with one click. We generate the automation blueprints tailored to the exact problem we found, complete with system access.
                            </p>
                        </Card>

                        <Card className="bg-zinc-900 border-zinc-800 p-8 hover:border-zinc-700 transition-colors">
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-6">
                                <Workflow className="w-6 h-6 text-emerald-400" />
                            </div>
                            <h3 className="text-2xl font-bold text-white mb-4">War Room</h3>
                            <p className="text-zinc-400 leading-relaxed">
                                Watch the savings happen in real-time. Link agents together in autonomous chains. See exactly how much human labor cost you've eliminated this month.
                            </p>
                        </Card>
                    </div>
                </section>
            </main>

            <footer className="py-8 border-t border-white/10 text-center text-zinc-500">
                <p>&copy; {new Date().getFullYear()} NexusOS. All rights reserved.</p>
            </footer>
        </div>
    );
}
