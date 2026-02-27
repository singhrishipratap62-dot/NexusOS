'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../components/ui/top-bar';
import ChainsClient from './chains-client';

export default function ChainsPage() {
    return (
        <>
            <TopBar
                title="Agent Chains"
                subtitle="Orchestrate collaboration between multiple AI agents"
            />
            <div className="page-content">
                <ChainsClient />
            </div>
        </>
    );
}
