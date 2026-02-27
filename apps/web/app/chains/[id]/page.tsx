'use client';
import { TopBar } from '../../../components/ui/top-bar';
import ChainDetailClient from './chain-detail-client';

export default function ChainDetailPage({ params }: { params: { id: string } }) {
    return (
        <>
            <TopBar title="Chain Details" />
            <div className="page-content">
                <ChainDetailClient chainId={params.id} />
            </div>
        </>
    );
}
