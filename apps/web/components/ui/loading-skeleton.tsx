'use client';
export function LoadingSkeleton({ rows = 4, columns = 6 }: { rows?: number; columns?: number }) {
    return (
        <div className="card overflow-hidden animate-pulse">
            <div className="p-4 space-y-3">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                        {Array.from({ length: columns }).map((_, j) => (
                            <div
                                key={j}
                                className="h-4 bg-muted rounded flex-1"
                                style={{ maxWidth: j === 0 ? '200px' : '100px' }}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
    return (
        <div className={`grid grid-cols-2 lg:grid-cols-${count} gap-4 mb-6`}>
            {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="stat-card animate-pulse">
                    <div className="h-3 w-20 bg-muted rounded mb-2" />
                    <div className="h-7 w-16 bg-muted rounded mb-1" />
                    <div className="h-3 w-24 bg-muted rounded" />
                </div>
            ))}
        </div>
    );
}

export function PageSkeleton({ statCount = 4, tableRows = 5 }: { statCount?: number; tableRows?: number }) {
    return (
        <div className="page-content">
            <StatCardSkeleton count={statCount} />
            <LoadingSkeleton rows={tableRows} />
        </div>
    );
}
