import { PageSkeleton } from '../../components/ui/loading-skeleton';
import { TopBar } from '../../components/ui/top-bar';

export default function ConnectorsLoading() {
    return (
        <>
            <TopBar title="Connectors" subtitle="Loading integrations..." />
            <div className="page-content">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="card p-5 animate-pulse">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-8 h-8 bg-muted rounded" />
                                <div className="flex-1">
                                    <div className="h-4 w-20 bg-muted rounded mb-1" />
                                    <div className="h-3 w-32 bg-muted rounded" />
                                </div>
                            </div>
                            <div className="h-8 w-24 bg-muted rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
