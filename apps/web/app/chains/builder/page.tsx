'use client';
export const dynamic = 'force-dynamic';
import { TopBar } from '../../../components/ui/top-bar';
import ChainBuilderClient from './chain-builder-client';

export default function ChainBuilderPage() {
    return (
        <>
            <TopBar title="Chain Builder" subtitle="Create multi-agent collaboration chains" />
            <div className="page-content">
                <ChainBuilderClient />
            </div>
        </>
    );
}
